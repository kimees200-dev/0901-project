const root = document.documentElement;
const page = location.pathname.split('/').pop() || 'index.html';

const headerHost = document.querySelector('[data-header]');
if (headerHost) headerHost.outerHTML = `<header class="blog-header"><nav class="blog-nav container" aria-label="주요 메뉴"><a class="blog-logo" href="index.html">기록의 온도<span>.</span></a><button class="theme-toggle" type="button" aria-label="다크 모드로 변경">☾</button><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav-list"><span class="sr-only">메뉴 열기</span><span></span><span></span><span></span></button><ul class="blog-nav-list" id="nav-list"><li><a href="posts.html">글 목록</a></li><li><a href="profile.html">프로필</a></li><li><a href="write.html">글쓰기</a></li><li><a href="login.html">로그인</a></li><li><a class="nav-cta" href="signup.html">회원가입</a></li></ul></nav></header>`;

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

const AUTH_API_URL = 'https://script.google.com/macros/s/AKfycbxIt134TfuoSSzAG4_HNLYw_Okm4Thkjv5i0yz1opc9zr6A8dpjitafBTV2xFQLlWlZ/exec';

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

const writeForm = document.querySelector('[data-form="write"]');
const draftButton = document.querySelector('#draft-button');
draftButton?.addEventListener('click', () => {
  const draft = Object.fromEntries(new FormData(writeForm));
  localStorage.setItem('blog-draft', JSON.stringify(draft));
  document.querySelector('#save-state').textContent = '임시 저장됨';
});
if (writeForm) {
  const draft = JSON.parse(localStorage.getItem('blog-draft') || 'null');
  if (draft) Object.entries(draft).forEach(([key,value]) => { if (writeForm.elements[key]) writeForm.elements[key].value = value; });
}

document.querySelector('.subscribe-form')?.addEventListener('submit', event => { event.preventDefault(); event.target.querySelector('button').textContent = '구독 완료'; });
const year = document.querySelector('#year'); if (year) year.textContent = new Date().getFullYear();
