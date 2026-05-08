# 웹툰 티어표 웹사이트

## 실행 방법
```bash
cd /workspace/choco-web-tier
npm install
ADMIN_USERNAME='myid' ADMIN_PASSWORD='mypassword' npm start
```

## 이번 개선 포인트
- 댓글 삭제 기능 추가(관리자): 댓글 옆 삭제 버튼 + 확인창(confirm)
- 추천/비추천(recommend/not_recommend) 선택 및 배지 표시
- 프리미엄 스타일 UI 개선(카드, 티어 섹션, 모달, 반응형)

## 핵심 기능
- 관리자: 웹툰 추가/수정/삭제, 댓글 삭제
- 방문자: 조회 + 댓글 작성
- 점수 체계: 0~10 소수점 1자리 표시
- 데이터 호환: legacy `rating` -> `score` fallback 변환
