const root = document.documentElement;
const page = location.pathname.split('/').pop() || 'index.html';

function getStoredSession() {
  try {
    const session = JSON.parse(localStorage.getItem('blog-session') || 'null');
    if (!session?.token || !session?.user) return null;
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem('blog-session');
      return null;
    }
    return session;
  } catch (error) {
    localStorage.removeItem('blog-session');
    return null;
  }
}

const currentSession = getStoredSession();
const authNavigation = currentSession
  ? `<li><button class="nav-logout" type="button">로그아웃</button></li><li><a class="nav-cta" href="profile.html">프로필</a></li>`
  : `<li><a href="login.html">로그인</a></li><li><a class="nav-cta" href="signup.html">회원가입</a></li>`;

const headerHost = document.querySelector('[data-header]');
if (headerHost) headerHost.outerHTML = `<header class="blog-header"><nav class="blog-nav container" aria-label="주요 메뉴"><a class="blog-logo" href="index.html">기록의 온도<span>.</span></a><button class="theme-toggle" type="button" aria-label="다크 모드로 변경">☾</button><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav-list"><span class="sr-only">메뉴 열기</span><span></span><span></span><span></span></button><ul class="blog-nav-list" id="nav-list"><li><a href="posts.html">글 목록</a></li><li><a href="write.html">글쓰기</a></li>${authNavigation}</ul></nav></header>`;

const footerHost = document.querySelector('[data-footer]');
if (footerHost) footerHost.outerHTML = `<footer class="blog-footer"><div class="container footer-inner"><p>© <span id="year"></span> 기록의 온도.</p><div><a href="profile.html">소개</a><a href="https://github.com/kimees200-dev" target="_blank" rel="noreferrer">GitHub</a></div></div></footer>`;

const themeButton = document.querySelector('.theme-toggle');
const savedTheme = localStorage.getItem('blog-theme');
function setTheme(theme) {
  root.dataset.theme = theme;
  if (!themeButton) return;
  const dark = theme === 'dark';
  themeButton.textContent = dark ? '☀' : '☾';
  themeButton.setAttribute('aria-label', dark ? '라이트 모드로 변경' : '다크 모드로 변경');
}
setTheme(savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeButton?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next); localStorage.setItem('blog-theme', next);
});

const menuButton = document.querySelector('.menu-toggle');
const navList = document.querySelector('.blog-nav-list');
menuButton?.addEventListener('click', () => {
  const open = navList.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
navList?.addEventListener('click', () => { navList.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); });

document.querySelectorAll('.blog-nav-list a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === page || (page === 'post-detail.html' && href === 'posts.html')) link.setAttribute('aria-current', 'page');
});

const validators = {
  email: value => /^\S+@\S+\.\S+$/.test(value),
  password: value => value.length >= 8
};

const AUTH_API_URL = 'https://script.google.com/macros/s/AKfycbzmIvvpME5ywQhvAvEQU5aTGRcifTAtC6lBLRxH1gHYZorX0Gkuw-IUdAbsOyYZFhit/exec';

async function authRequest(payload) {
  const response = await fetch(AUTH_API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();

  if (!response.ok || text.trim().startsWith('<!DOCTYPE') || text.includes('액세스 권한 필요')) {
    throw new Error('Apps Script 접근이 거부되었습니다. 웹 앱 액세스 권한을 모든 사용자로 변경해 주세요.');
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('서버가 올바른 JSON을 반환하지 않았습니다. Apps Script 배포 버전을 확인해 주세요.');
  }
}

async function apiGet(action, parameters = {}) {
  const query = new URLSearchParams({ action, ...parameters });
  const response = await fetch(`${AUTH_API_URL}?${query}`, { redirect: 'follow' });
  const text = await response.text();
  if (!response.ok || text.trim().startsWith('<!DOCTYPE')) throw new Error('게시글 서버에 연결할 수 없습니다.');
  try { return JSON.parse(text); } catch (error) { throw new Error('서버 응답 형식이 올바르지 않습니다.'); }
}

function escapeHtml(value = '') {
  const element = document.createElement('div');
  element.textContent = String(value);
  return element.innerHTML;
}

function formatPostDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date);
}

document.querySelector('.nav-logout')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = '로그아웃 중…';
  try {
    await authRequest({ action: 'logout', token: currentSession?.token });
  } catch (error) {
    console.warn('서버 로그아웃 요청에 실패해 로컬 세션만 정리합니다.', error);
  } finally {
    localStorage.removeItem('blog-session');
    location.href = 'index.html';
  }
});

document.querySelectorAll('.app-form').forEach(form => {
  form.addEventListener('submit', async event => {
    event.preventDefault(); let valid = true;
    form.querySelectorAll('[required]').forEach(field => {
      let bad = field.type === 'checkbox' ? !field.checked : !field.value.trim();
      if (!bad && validators[field.name]) bad = !validators[field.name](field.value);
      if (field.name === 'confirm') bad = field.value !== form.elements.password.value;
      field.classList.toggle('invalid', bad);
      const error = field.closest('.field')?.querySelector('.error');
      if (error) error.textContent = bad ? (field.name === 'email' ? '올바른 이메일을 입력해 주세요.' : field.name === 'password' ? '8자 이상 입력해 주세요.' : field.name === 'confirm' ? '비밀번호가 일치하지 않습니다.' : '필수 입력 항목입니다.') : '';
      if (bad) valid = false;
    });
    const status = form.querySelector('.form-status');
    if (!valid) { status.textContent = '입력 내용을 확인해 주세요.'; form.querySelector('.invalid')?.focus(); return; }
    const type = form.dataset.form;
    if (type !== 'signup' && type !== 'login') {
      status.textContent = '게시글이 확인되었습니다. 백엔드 연결 후 실제 게시됩니다.';
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = type === 'signup' ? '가입 중…' : '로그인 중…';

    try {
      const payload = {
        action: type,
        email: form.elements.email.value.trim(),
        password: form.elements.password.value,
      };
      if (type === 'signup') payload.name = form.elements.name.value.trim();

      const result = await authRequest(payload);
      if (!result.success) throw new Error(result.message || '요청을 처리하지 못했습니다.');

      if (type === 'signup') {
        status.textContent = result.message;
        setTimeout(() => { location.href = 'login.html'; }, 900);
      } else {
        localStorage.setItem('blog-session', JSON.stringify({ token: result.token, expiresAt: result.expiresAt, user: result.user }));
        status.textContent = result.message;
        setTimeout(() => { location.href = 'profile.html'; }, 500);
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = type === 'signup' ? '계정 만들기' : '로그인';
    }
  });
  form.addEventListener('input', event => { event.target.classList.remove('invalid'); const error = event.target.closest('.field')?.querySelector('.error'); if (error) error.textContent = ''; });
});

const filterButtons = document.querySelectorAll('[data-filter]');
const search = document.querySelector('#post-search');
let activeFilter = 'all';
function filterPosts() {
  const query = (search?.value || '').trim().toLowerCase(); let count = 0;
  document.querySelectorAll('#post-list article').forEach(post => {
    const show = (activeFilter === 'all' || post.dataset.category === activeFilter) && post.textContent.toLowerCase().includes(query);
    post.hidden = !show; if (show) count++;
  });
  const empty = document.querySelector('.empty-state'); if (empty) empty.hidden = count > 0;
}
filterButtons.forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.filter; filterButtons.forEach(item => item.classList.toggle('active', item === button)); filterPosts(); }));
search?.addEventListener('input', filterPosts);

async function loadPublicPosts() {
  const list = document.querySelector('#post-list');
  if (!list) return;
  try {
    const result = await apiGet('posts');
    if (!result.success) throw new Error(result.message || '게시글을 불러오지 못했습니다.');
    list.innerHTML = result.posts.map(post => `<article data-category="${escapeHtml(post.category === '일상' ? 'life' : 'dev')}"><a href="post-detail.html?id=${encodeURIComponent(post.id)}"><div class="list-cover cover-purple">${escapeHtml(post.category)}</div><div><p class="post-meta">${escapeHtml(post.category)} · ${escapeHtml(formatPostDate(post.createdAt))}</p><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.summary)}</p></div></a></article>`).join('');
    if (!result.posts.length) document.querySelector('.empty-state').hidden = false;
    filterPosts();
  } catch (error) {
    list.innerHTML = `<p class="my-posts-status">${escapeHtml(error.message)}</p>`;
  }
}

async function loadHomePosts() {
  if (page !== 'index.html') return;
  const grid = document.querySelector('.post-grid');
  if (!grid) return;
  try {
    const result = await apiGet('posts');
    if (!result.success) throw new Error(result.message || '최근 게시글을 불러오지 못했습니다.');
    const colors = ['cover-purple', 'cover-blue', 'cover-green'];
    grid.innerHTML = result.posts.slice(0, 3).map((post, index) => `<article class="post-card"><a href="post-detail.html?id=${encodeURIComponent(post.id)}"><div class="post-cover ${colors[index % colors.length]}"><span>${escapeHtml(post.category)}</span></div><div class="post-content"><p class="post-meta">${escapeHtml(post.category)} · ${escapeHtml(formatPostDate(post.createdAt))}</p><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.summary)}</p><div class="post-author"><img src="assets/images/profile.jpeg" alt=""><span>${escapeHtml(post.author)}</span></div></div></a></article>`).join('');
    if (!result.posts.length) grid.innerHTML = '<p class="my-posts-status">아직 작성된 게시글이 없습니다.</p>';
  } catch (error) {
    grid.innerHTML = `<p class="my-posts-status">${escapeHtml(error.message)}</p>`;
  }
}

async function loadPostDetail() {
  if (page !== 'post-detail.html') return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;
  try {
    const result = await apiGet('post', { id });
    if (!result.success) throw new Error(result.message);
    const post = result.post;
    document.querySelector('.article-header .blog-kicker').textContent = post.category;
    document.querySelector('.article-header h1').textContent = post.title;
    document.querySelector('.article-lead').textContent = post.summary;
    document.querySelector('.article-author b').textContent = post.author;
    document.querySelector('.article-author span').textContent = formatPostDate(post.createdAt);
    const body = document.querySelector('.article-body');
    body.innerHTML = '';
    String(post.content).split(/\n{2,}/).forEach(paragraph => { const item = document.createElement('p'); item.textContent = paragraph; body.appendChild(item); });
  } catch (error) {
    document.querySelector('.article-body').textContent = error.message;
  }
}

function renderMyPosts(posts) {
  const list = document.querySelector('#my-posts-list');
  const status = document.querySelector('.my-posts-status');
  if (!list || !status) return;
  const count = document.querySelector('.my-post-count');
  if (count) count.textContent = `${posts.length}개`;
  status.textContent = posts.length ? '' : '작성한 게시글이 없습니다.';
  list.innerHTML = posts.map(post => `<article class="my-post-item" data-post-id="${escapeHtml(post.id)}"><div><p>${escapeHtml(post.category)} · ${escapeHtml(formatPostDate(post.createdAt))}</p><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.summary)}</p></div><div class="my-post-actions"><a href="post-detail.html?id=${encodeURIComponent(post.id)}">보기</a><a href="write.html?id=${encodeURIComponent(post.id)}">수정</a><button class="delete-post" type="button">삭제</button></div></article>`).join('');
}

async function loadMyPosts() {
  const list = document.querySelector('#my-posts-list');
  if (!list) return;
  const status = document.querySelector('.my-posts-status');
  if (!currentSession) { status.innerHTML = '내 게시글을 관리하려면 <a class="button primary" href="login.html">로그인</a>해 주세요.'; return; }
  try {
    const result = await authRequest({ action: 'myPosts', token: currentSession.token });
    if (!result.success) throw new Error(result.message);
    renderMyPosts(result.posts);
  } catch (error) { status.textContent = error.message; }
}

document.querySelector('#my-posts-list')?.addEventListener('click', async event => {
  const button = event.target.closest('.delete-post');
  if (!button) return;
  const item = button.closest('[data-post-id]');
  if (!confirm('이 게시글을 삭제할까요? 삭제 후 복구할 수 없습니다.')) return;
  button.disabled = true;
  try {
    const result = await authRequest({ action: 'deletePost', token: currentSession?.token, postId: item.dataset.postId });
    if (!result.success) throw new Error(result.message);
    item.remove();
    if (!document.querySelector('.my-post-item')) document.querySelector('.my-posts-status').textContent = '작성한 게시글이 없습니다.';
  } catch (error) { alert(error.message); button.disabled = false; }
});

loadPublicPosts();
loadHomePosts();
loadPostDetail();
loadMyPosts();

const writeForm = document.querySelector('[data-form="write"]');
const draftButton = document.querySelector('#draft-button');
const editingPostId = page === 'write.html' ? new URLSearchParams(location.search).get('id') : null;
writeForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const status = writeForm.querySelector('.form-status');
  const button = writeForm.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = '저장 중…';
  try {
    const session = JSON.parse(localStorage.getItem('blog-session') || 'null');
    if (!session?.token) throw new Error('로그인 후 게시글을 저장해 주세요.');
    const result = await authRequest({
      ...Object.fromEntries(new FormData(writeForm)),
      action: editingPostId ? 'updatePost' : 'createPost',
      token: session.token,
      postId: editingPostId || undefined,
    });
    if (!result.success) throw new Error(result.message || '게시글을 저장하지 못했습니다.');
    status.textContent = result.message;
    document.querySelector('#save-state').textContent = '저장됨';
    localStorage.removeItem('blog-draft');
    if (editingPostId) {
      setTimeout(() => { location.href = 'profile.html#my-posts-section'; }, 600);
    } else {
      document.querySelector('#save-state').textContent = '게시됨';
      setTimeout(() => { location.href = `post-detail.html?id=${encodeURIComponent(result.postId)}`; }, 600);
    }
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = '게시하기';
  }
});
draftButton?.addEventListener('click', () => {
  const draft = Object.fromEntries(new FormData(writeForm));
  localStorage.setItem('blog-draft', JSON.stringify(draft));
  document.querySelector('#save-state').textContent = '임시 저장됨';
});
if (writeForm) {
  const draft = JSON.parse(localStorage.getItem('blog-draft') || 'null');
  if (draft) Object.entries(draft).forEach(([key,value]) => { if (writeForm.elements[key]) writeForm.elements[key].value = value; });
}

async function loadPostForEditing() {
  if (!writeForm || !editingPostId) return;
  if (!currentSession) { location.href = 'login.html'; return; }
  document.querySelector('.editor-head h1').textContent = '게시글 수정';
  writeForm.querySelector('[type="submit"]').textContent = '수정 완료';
  try {
    const result = await authRequest({ action: 'myPost', token: currentSession.token, postId: editingPostId });
    if (!result.success) throw new Error(result.message);
    ['category', 'title', 'summary', 'tags', 'content'].forEach(key => { writeForm.elements[key].value = result.post[key] || ''; });
    document.querySelector('#save-state').textContent = '수정 중';
  } catch (error) { writeForm.querySelector('.form-status').textContent = error.message; }
}
loadPostForEditing();

document.querySelector('.subscribe-form')?.addEventListener('submit', event => { event.preventDefault(); event.target.querySelector('button').textContent = '구독 완료'; });
const year = document.querySelector('#year'); if (year) year.textContent = new Date().getFullYear();
