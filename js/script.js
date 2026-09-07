const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
const menuButton = document.querySelector('.menu-toggle');
const navList = document.querySelector('.nav-list');
const savedTheme = localStorage.getItem('profile-theme');

function setTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === 'dark';
  themeButton.textContent = dark ? '☀' : '☾';
  themeButton.setAttribute('aria-label', dark ? '라이트 모드로 변경' : '다크 모드로 변경');
}

setTheme(savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeButton.addEventListener('click', () => {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  localStorage.setItem('profile-theme', theme);
});

menuButton.addEventListener('click', () => {
  const open = navList.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('.sr-only').textContent = open ? '메뉴 닫기' : '메뉴 열기';
});

navList.addEventListener('click', event => {
  if (event.target.closest('a')) {
    navList.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
});

const form = document.querySelector('#contact-form');
form?.addEventListener('submit', event => {
  event.preventDefault();
  let valid = true;
  const messages = { name: '이름을 입력해 주세요.', email: '올바른 이메일 주소를 입력해 주세요.', message: '메시지를 입력해 주세요.' };

  [...form.elements].filter(field => field.matches('input, textarea')).forEach(field => {
    const wrongEmail = field.type === 'email' && !/^\S+@\S+\.\S+$/.test(field.value.trim());
    const invalid = !field.value.trim() || wrongEmail;
    field.classList.toggle('invalid', invalid);
    field.setAttribute('aria-invalid', String(invalid));
    field.parentElement.querySelector('.error').textContent = invalid ? messages[field.name] : '';
    if (invalid) valid = false;
  });

  const status = form.querySelector('.form-status');
  if (valid) {
    status.textContent = '입력 내용이 확인되었습니다. 현재는 예시 폼이므로 실제 전송되지는 않습니다.';
    form.reset();
  } else {
    status.textContent = '입력 내용을 다시 확인해 주세요.';
    form.querySelector('.invalid')?.focus();
  }
});

form?.addEventListener('input', event => {
  if (event.target.matches('input, textarea')) {
    event.target.classList.remove('invalid');
    event.target.removeAttribute('aria-invalid');
    event.target.parentElement.querySelector('.error').textContent = '';
  }
});

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();
