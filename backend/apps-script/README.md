# Google Apps Script 회원 인증 API

## 1. 코드 등록

1. Google 스프레드시트에서 `확장 프로그램 → Apps Script`를 선택합니다.
2. 기본 `Code.gs` 내용을 지웁니다.
3. 이 폴더의 `Code.gs` 전체를 붙여 넣고 저장합니다.

## 2. 스크립트 속성 설정

Apps Script의 `프로젝트 설정 → 스크립트 속성`에서 다음 값을 추가합니다.

| 속성 | 값 |
|---|---|
| `SPREADSHEET_ID` | 연결할 스프레드시트 URL의 `/d/`와 `/edit` 사이 값 |
| `PASSWORD_PEPPER` | 외부에 공개하지 않을 길고 무작위인 문자열 |

스프레드시트에 연결된 Apps Script라면 `SPREADSHEET_ID`는 생략할 수 있지만 명시적인 설정을 권장합니다.

`PASSWORD_PEPPER`는 GitHub나 프론트엔드 코드에 절대 추가하지 않습니다.

## 3. 시트 초기화

Apps Script 편집기 상단의 함수 목록에서 `setupSheets`를 선택해 한 번 실행합니다. Google 계정 권한 요청을 승인하면 다음 시트가 생성됩니다.

`setupSheets`를 실행하지 않아도 최초 회원가입 또는 로그인 요청 시 필요한 시트를 자동 생성하도록 구성되어 있습니다. 다만 배포 전에 권한 승인과 연결 상태를 명확히 확인하기 위해 직접 실행하는 방식을 권장합니다.

- `users`: 사용자 ID, 이름, 이메일, 비밀번호 해시, salt, 권한, 생성일
- `sessions`: 해시 처리된 로그인 토큰, 사용자 ID, 만료일, 생성일

비밀번호 원문과 로그인 토큰 원문은 스프레드시트에 저장되지 않습니다.

## 4. 웹 앱 배포

1. `배포 → 새 배포`를 선택합니다.
2. 유형은 `웹 앱`을 선택합니다.
3. 실행 사용자는 `나`로 설정합니다.
4. 액세스 권한은 프론트엔드에서 호출할 수 있는 범위로 설정합니다.
5. 배포 후 `/exec`으로 끝나는 웹 앱 URL을 복사합니다.

배포 주소는 현재 프론트엔드의 `js/script.js`에 있는 `AUTH_API_URL`에 설정합니다.

시크릿 브라우저에서 아래 주소를 열었을 때 로그인 화면이 아니라 JSON이 보여야 공개 접근 설정이 정상입니다.

```text
웹앱_URL?action=health
```

코드를 변경할 때는 `배포 관리 → 수정 → 새 버전`으로 다시 배포해야 반영됩니다.

## 5. 요청 형식

프론트엔드에서는 브라우저의 불필요한 preflight 요청을 줄이기 위해 `Content-Type: text/plain;charset=utf-8`로 JSON 문자열을 전송합니다.

### 회원가입

```json
{
  "action": "signup",
  "name": "김개발",
  "email": "user@example.com",
  "password": "example1234"
}
```

### 로그인

```json
{
  "action": "login",
  "email": "user@example.com",
  "password": "example1234"
}
```

로그인 성공 응답에는 24시간 동안 유효한 `token`이 포함됩니다.

### 현재 사용자

```text
GET 웹앱_URL?action=me&token=로그인_토큰
```

### 로그아웃

```json
{
  "action": "logout",
  "token": "로그인_토큰"
}
```

## 보안 및 한계

- SHA-256 + salt + pepper를 적용했지만, 본격적인 서비스 인증은 Firebase Authentication 같은 전문 인증 서비스를 권장합니다.
- Apps Script와 스프레드시트는 소규모 학습·개인 프로젝트에 적합하며 대규모 인증 서버를 대신하지 않습니다.
- 웹 앱 URL, 요청 횟수 제한, 동시 실행 제한을 고려해야 합니다.
- 세션 토큰을 URL로 전송하면 서버 및 브라우저 기록에 남을 수 있습니다. 현재 사용자 조회도 운영 환경에서는 POST 방식으로 바꾸는 것이 더 안전합니다.
