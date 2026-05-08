# Webtoon Tier List 프로젝트 플랜

## 목표
- 개인 웹툰 추천 사이트를 빠르게 만들고 링크로 공유할 수 있게 한다.

## 범위 (MVP)
1. 웹툰 등록(제목/장르/티어/별점/메모)
2. 티어별 정렬 UI
3. 별점/티어 수정 및 삭제
4. 서버 파일 저장(JSON)

## 백엔드
- Node.js + Express
- REST API
  - `GET /api/webtoons`
  - `POST /api/webtoons`
  - `PATCH /api/webtoons/:id`
  - `DELETE /api/webtoons/:id`

## 프론트엔드
- 정적 HTML/CSS/Vanilla JS
- 티어별 카드 렌더링
- 인라인 수정(티어/별점)

## 다음 단계
- 로그인/사용자별 목록 분리
- DB(SQLite/PostgreSQL)로 마이그레이션
- 공유용 공개 링크(slug) 지원
