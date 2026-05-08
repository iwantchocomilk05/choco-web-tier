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

---

## Cloudflare Pages 배포 가이드

현재 프로젝트는 **Express 서버(`server.js`) + 파일 저장(`data/webtoons.json`)** 구조입니다.
Cloudflare Pages는 정적 빌드/Functions 기반이라 **Express 서버를 그대로 실행할 수 없습니다**.

### 권장 배포 구조 (기능 보존 우선)
1. **Cloudflare Pages**: 프론트엔드(`public/`) 배포
2. **외부 백엔드**(Render/Fly.io/Railway/EC2 등): 현재 `server.js` 실행
3. 프론트의 API 요청을 외부 백엔드 URL로 연결(환경변수 또는 리버스 프록시)

### Cloudflare Pages 설정값
- Framework preset: `None`
- Build command: *(비워도 됨)*
- Build output directory: `public`
- Environment variables:
  - `API_BASE_URL` (프론트가 외부 백엔드로 호출하도록 바꿀 경우)

### GitHub 연결 배포 순서
1. Cloudflare Dashboard → Pages → Create a project
2. GitHub 저장소 연결
3. Branch: `main` (또는 미리 테스트하려면 `cloudflare-deploy-setup-branch`)
4. 위 설정값 입력 후 Deploy

### 로컬 실행
```bash
npm install
ADMIN_USERNAME='myid' ADMIN_PASSWORD='mypassword' npm start
```

### 배포 후 확인 경로
- 메인: `/`
- 상세: `/#/work/{id}`

### Cloudflare 단독(Workers + D1) 전환 가능 여부
가능은 하지만, 현재 Express + JSON 저장 코드를 **Workers/D1용 API로 재구현**해야 합니다.
이 저장소에는 준비용으로 D1 스키마 초안 파일을 추가했습니다:
- `cloudflare/migrations/0001_init.sql`

즉, **이번 변경은 기능을 깨지 않고 배포 경로를 정리**하는 데 집중했습니다.
