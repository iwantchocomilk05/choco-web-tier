# 웹툰 티어표 웹사이트

## 실행 방법 (Codespaces 터미널 복붙)

```bash
cd /workspace/choco-web-tier
npm install
ADMIN_USERNAME='myid' ADMIN_PASSWORD='mypassword' npm start
```

브라우저에서 `http://localhost:3000` 접속.

## 권한 정책
- 일반 사용자: 조회 + 댓글 작성 가능
- 관리자(나): 로그인 후 웹툰 추가/수정/삭제 가능
- 로그인은 서버 세션 쿠키 기반

## 주요 기능
- 티어/별점 관리
- 웹툰 표지 이미지 URL 등록
- 웹툰별 댓글 기능
