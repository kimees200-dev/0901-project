const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function backend() {
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName: name => sheets.get(name),
    insertSheet(name) {
      const rows = [];
      const sheet = {
        rows,
        getLastRow: () => rows.length,
        appendRow: row => rows.push(row),
        setFrozenRows() {},
        getRange: () => ({ setFontWeight() {} }),
      };
      sheets.set(name, sheet);
      return sheet;
    },
  };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: () => 'post-id' },
  });
  vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), context);
  return { context, spreadsheet, sheets };
}

test('existing empty users sheet gets headers before data is written', () => {
  const { context, spreadsheet } = backend();
  spreadsheet.insertSheet('users');
  const sheet = context.getRequiredSheet_('users');
  assert.equal(sheet.rows.length, 1);
  assert.equal(sheet.rows[0][2], 'email');
});

test('post creation rejects unauthenticated requests without writing', () => {
  const { context, sheets } = backend();
  assert.equal(context.createPost_({}).success, false);
  assert.equal(sheets.size, 0);
});

test('authenticated posts are stored with headers and literal text', () => {
  const { context, sheets } = backend();
  context.getCurrentUser_ = () => ({ success: true, user: { id: 'user-id' } });
  const result = context.createPost_({ category: '개발', title: '=1+1', summary: '요약', content: '본문' });
  assert.equal(result.success, true);
  const rows = sheets.get('posts').rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0][3], 'title');
  assert.equal(rows[1][1], 'user-id');
  assert.equal(rows[1][3], "'=1+1");
  assert.equal(rows[1][6], '본문');
});

test('invalid post content does not create a sheet', () => {
  const { context, sheets } = backend();
  context.getCurrentUser_ = () => ({ success: true, user: { id: 'user-id' } });
  assert.throws(() => context.createPost_({ category: '개발' }), /제목/);
  assert.equal(sheets.size, 0);
});
