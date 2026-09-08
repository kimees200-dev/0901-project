/**
 * 기록의 온도 - 회원 인증 API
 * Google Apps Script의 Code.gs에 붙여 넣어 사용합니다.
 */

const CONFIG = Object.freeze({
  USERS_SHEET: 'users',
  SESSIONS_SHEET: 'sessions',
  SESSION_HOURS: 24,
  MIN_PASSWORD_LENGTH: 8,
});

const SHEET_HEADERS = Object.freeze({
  users: ['id', 'name', 'email', 'passwordHash', 'salt', 'role', 'createdAt', 'updatedAt'],
  sessions: ['token', 'userId', 'expiresAt', 'createdAt'],
});

function doGet(e) {
  try {
    const action = String(e.parameter.action || 'health');

    if (action === 'health') {
      return response({
        success: true,
        message: 'API가 정상 작동 중입니다.',
        service: 'temperature-of-record-auth',
        version: '1.1.0',
        setupComplete: PropertiesService.getScriptProperties().getProperty('SETUP_COMPLETE') === 'true',
      });
    }

    if (action === 'me') {
      return response(getCurrentUser_(e.parameter.token));
    }

    return response({ success: false, message: '지원하지 않는 요청입니다.' });
  } catch (error) {
    return errorResponse_(error);
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const action = String(body.action || '');

    switch (action) {
      case 'signup':
        return response(signup_(body));
      case 'login':
        return response(login_(body));
      case 'logout':
        return response(logout_(body.token));
      default:
        return response({ success: false, message: '지원하지 않는 요청입니다.' });
    }
  } catch (error) {
    return errorResponse_(error);
  }
}

/** 최초 1회 실행해 users, sessions 시트와 헤더를 생성합니다. */
function setupSheets() {
  const spreadsheet = getSpreadsheet_();
  ensureSheet_(spreadsheet, CONFIG.USERS_SHEET, SHEET_HEADERS.users);
  ensureSheet_(spreadsheet, CONFIG.SESSIONS_SHEET, SHEET_HEADERS.sessions);

  PropertiesService.getScriptProperties().setProperty('SETUP_COMPLETE', 'true');
  return '시트 초기화가 완료되었습니다.';
}

function signup_(body) {
  const name = cleanText_(body.name, 50);
  const email = normalizeEmail_(body.email);
  const password = String(body.password || '');

  validateSignup_(name, email, password);
  const usersSheet = getRequiredSheet_(CONFIG.USERS_SHEET);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const users = getRowsAsObjects_(usersSheet);

    if (users.some(user => normalizeEmail_(user.email) === email)) {
      return { success: false, message: '이미 가입된 이메일입니다.' };
    }

    const now = new Date().toISOString();
    const id = Utilities.getUuid();
    const salt = createToken_();
    const passwordHash = hashPassword_(password, salt);

    usersSheet.appendRow([id, name, email, passwordHash, salt, 'member', now, now]);

    return {
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: publicUser_({ id, name, email, role: 'member', createdAt: now }),
    };
  } finally {
    lock.releaseLock();
  }
}

function login_(body) {
  const email = normalizeEmail_(body.email);
  const password = String(body.password || '');

  if (!isEmail_(email) || !password) {
    return { success: false, message: '이메일 또는 비밀번호를 확인해 주세요.' };
  }

  const usersSheet = getRequiredSheet_(CONFIG.USERS_SHEET);
  const user = getRowsAsObjects_(usersSheet)
    .find(item => normalizeEmail_(item.email) === email);

  // 가입 여부가 노출되지 않도록 동일한 메시지를 반환합니다.
  if (!user || !safeEquals_(hashPassword_(password, user.salt), String(user.passwordHash))) {
    return { success: false, message: '이메일 또는 비밀번호를 확인해 주세요.' };
  }

  deleteExpiredSessions_();

  const token = createToken_() + createToken_();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + CONFIG.SESSION_HOURS * 60 * 60 * 1000);
  const sessionsSheet = getRequiredSheet_(CONFIG.SESSIONS_SHEET);
  sessionsSheet.appendRow([
    hashToken_(token), user.id, expiresAt.toISOString(), createdAt.toISOString(),
  ]);

  return {
    success: true,
    message: '로그인되었습니다.',
    token,
    expiresAt: expiresAt.toISOString(),
    user: publicUser_(user),
  };
}

function logout_(token) {
  if (!token) return { success: true, message: '로그아웃되었습니다.' };

  const sheet = getRequiredSheet_(CONFIG.SESSIONS_SHEET);
  const tokenHash = hashToken_(String(token));
  const rows = sheet.getDataRange().getValues();

  for (let row = rows.length - 1; row >= 1; row--) {
    if (safeEquals_(String(rows[row][0]), tokenHash)) sheet.deleteRow(row + 1);
  }

  return { success: true, message: '로그아웃되었습니다.' };
}

function getCurrentUser_(token) {
  if (!token) return { success: false, message: '로그인이 필요합니다.' };

  deleteExpiredSessions_();
  const tokenHash = hashToken_(String(token));
  const session = getRowsAsObjects_(getRequiredSheet_(CONFIG.SESSIONS_SHEET))
    .find(item => safeEquals_(String(item.token), tokenHash));

  if (!session) return { success: false, message: '세션이 만료되었거나 유효하지 않습니다.' };

  const user = getRowsAsObjects_(getRequiredSheet_(CONFIG.USERS_SHEET))
    .find(item => String(item.id) === String(session.userId));

  if (!user) return { success: false, message: '사용자를 찾을 수 없습니다.' };
  return { success: true, user: publicUser_(user) };
}

function deleteExpiredSessions_() {
  const sheet = getRequiredSheet_(CONFIG.SESSIONS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const now = Date.now();

  for (let row = rows.length - 1; row >= 1; row--) {
    if (new Date(rows[row][2]).getTime() <= now) sheet.deleteRow(row + 1);
  }
}

function validateSignup_(name, email, password) {
  if (name.length < 2) throw new Error('이름은 2자 이상 입력해 주세요.');
  if (!isEmail_(email)) throw new Error('올바른 이메일을 입력해 주세요.');
  if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
    throw new Error(`비밀번호는 ${CONFIG.MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`);
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('비밀번호에는 영문과 숫자를 모두 포함해 주세요.');
  }
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('스크립트 속성에 SPREADSHEET_ID를 설정해 주세요.');
  return active;
}

function getRequiredSheet_(name) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    const headers = SHEET_HEADERS[name];
    if (!headers) throw new Error(`지원하지 않는 시트입니다: ${name}`);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      Object.keys(SHEET_HEADERS).forEach(sheetName => {
        ensureSheet_(spreadsheet, sheetName, SHEET_HEADERS[sheetName]);
      });
      sheet = spreadsheet.getSheetByName(name);
      PropertiesService.getScriptProperties().setProperty('SETUP_COMPLETE', 'true');
    } finally {
      lock.releaseLock();
    }
  }

  return sheet;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return sheet;
}

function getRowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(row => Object.fromEntries(
    headers.map((header, index) => [header, row[index]])
  ));
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('요청 본문이 없습니다.');
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('올바른 JSON 요청이 아닙니다.');
  }
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse_(error) {
  console.error(error && error.stack ? error.stack : error);
  return response({ success: false, message: error.message || '서버 오류가 발생했습니다.' });
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanText_(value, maxLength) {
  return String(value || '').trim().replace(/[<>]/g, '').slice(0, maxLength);
}

function isEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashPassword_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER') || '';
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${salt}:${password}:${pepper}`,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

function hashToken_(token) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    token,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

function createToken_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function safeEquals_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function publicUser_(user) {
  return {
    id: String(user.id),
    name: String(user.name),
    email: String(user.email),
    role: String(user.role || 'member'),
    createdAt: user.createdAt,
  };
}
