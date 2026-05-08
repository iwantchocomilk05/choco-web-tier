# 웹툰 평가

## 실행
```bash
npm install
ADMIN_USERNAME='myid' ADMIN_PASSWORD='mypassword' npm start
```

## 이번 PR 핵심
- 작품 좋아요/싫어요: 상호 배타 토글 + localStorage 유지
- 댓글 좋아요: 1회 토글 + localStorage 유지
- 관리자 작품 삭제 버그 수정(상세에서 삭제/즉시 반영)
- 햄버거 메뉴: 바깥 클릭/Esc 닫힘
- 상세 페이지에서 메인 헤더 숨김
- 메인 제목을 `웹툰 평가`로 변경 + 가운데 정렬
- 대댓글(reply) 작성/삭제/시간 표시
- 관리자 댓글/대댓글: 닉네임 `쪼코우유먹을래` + 무지개 텍스트 + ADMIN 배지
