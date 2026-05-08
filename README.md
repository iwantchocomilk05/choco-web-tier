# 웹툰 티어표 웹사이트

나만 관리자로 수정하고, 다른 사람은 링크로 접속해서 조회/댓글만 할 수 있는 웹툰 티어표 사이트입니다.

## 1) Codespaces에서 실행 (복붙)

```bash
cd /workspace/choco-web-tier
npm install
ADMIN_USERNAME='myid' ADMIN_PASSWORD='mypassword' npm start
```

실행 후 브라우저에서 `http://localhost:3000` 접속.

## 2) 사용법

### 관리자(나)
1. 상단 관리자 로그인에 `ADMIN_USERNAME`, `ADMIN_PASSWORD` 입력
2. 로그인 후 웹툰 추가/수정/삭제 가능
3. 표지 이미지 URL 입력 시 카드에 표지가 표시됨

### 일반 방문자
- 티어표 조회 가능
- 웹툰별 댓글 작성 가능
- 웹툰 추가/수정/삭제는 불가

## 3) 권한 구조
- `POST /api/webtoons`, `PATCH /api/webtoons/:id`, `DELETE /api/webtoons/:id`는 관리자 세션 필수
- 로그인 세션은 서버가 `HttpOnly` 쿠키로 관리

## 4) 환경변수
- `ADMIN_USERNAME`: 관리자 아이디
- `ADMIN_PASSWORD`: 관리자 비밀번호 (반드시 강한 값으로 설정)
- `PORT`: 서버 포트 (기본 3000)
