# Webtoon Tier Lounge

## 실행
```bash
cd /workspace/choco-web-tier
npm install
ADMIN_USERNAME='myid' ADMIN_PASSWORD='mypassword' npm start
```

## 주요 개선
- anime healing / manga community 톤 UI 리디자인 (soft pastel, cozy layout)
- 작품 클릭 시 **full screen 상세 view** (`#/work/:id` hash route)
- 작품 좋아요/싫어요 카운트
- 댓글 삭제(관리자), 댓글 좋아요, 댓글 정렬(최신순/추천순)
- 댓글 시간 표시: `MM/DD HH:mm`
- 관리자 메뉴를 hamburger drawer로 이동

## 폰트
- 타이틀/강조: **Cafe24 Ssurround** 적용 (`@font-face`)
- 본문: Pretendard/Noto Sans KR/system sans-serif fallback
- 폰트 선언 위치: `public/styles.css`
- 사용 소스: 프로젝트 눈누 CDN의 Cafe24Ssurround WOFF
  - URL: `https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.1/Cafe24Ssurround.woff`
- 라이선스/배포 조건은 Cafe24/눈누 고지 기준을 확인해 사용해주세요.
