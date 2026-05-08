# 웹툰 티어표 웹사이트

내가 좋아하는 웹툰을 모아 티어(S~D)와 별점(1~5)으로 관리하는 개인 추천 사이트.

## 실행 방법

```bash
npm install
ADMIN_PASSWORD='내_비밀번호' npm start
```

브라우저에서 `http://localhost:3000` 접속.

## 관리자/공개 권한
- 기본: 모두 조회 가능 (읽기 전용)
- 관리자: 비밀번호 입력 후 작성/수정/삭제 가능
- 백엔드 쓰기 API(`POST/PATCH/DELETE`)는 `x-admin-password` 헤더 검증으로 보호됨

> 운영 전에 꼭 `ADMIN_PASSWORD`를 강한 값으로 설정하세요.

## 주요 코드
- 프론트엔드 메인: `public/main.js`
- 백엔드 엔트리: `server.js`
- 기획/플랜: `docs/PLAN.md`
