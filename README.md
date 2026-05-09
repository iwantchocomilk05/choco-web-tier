# 웹툰 평가

## 왜 Cloudflare Pages에서 기능이 사라졌나?
기존 구조는 `Express(server.js) + data/webtoons.json` 파일 저장입니다.
Cloudflare Pages는 정적 파일만 배포하면 Node 서버가 실행되지 않아서 `/api/*` 기능이 사라집니다.

## 이번 구조
- 프론트: `public/` (Cloudflare Pages)
- API: `functions/api/[[path]].js` (Cloudflare Pages Functions)
- 저장소: Cloudflare D1 (`DB` binding)

## Cloudflare Pages 설정값
- Framework preset: `None`
- Build command: *(비워도 됨)*
- Build output directory: `public`
- Environment variables:
  - `ADMIN_PASSWORD` (관리자 인증용)
- D1 binding 이름: `DB`

## wrangler.toml
- `pages_build_output_dir = "public"`
- `[[d1_databases]] binding = "DB"`

## D1 초기화
```bash
npx wrangler d1 create webtoon-tier-db
# 생성된 database_id를 wrangler.toml에 반영
npx wrangler d1 migrations apply webtoon-tier-db --local
npx wrangler d1 migrations apply webtoon-tier-db --remote
```

## 로컬 개발
```bash
npm install
npx wrangler pages dev public --d1=DB
```

## GitHub 연결 배포
1. Cloudflare Pages에서 GitHub repo 연결
2. Branch: `cloudflare-deploy-setup-branch`
3. 위 설정값 입력 후 Deploy

## 배포 후 확인 경로
- `/`
- `/#/work/{id}`
- API 확인: `/api/webtoons`

## 주의
- 이번 변경은 Cloudflare에서 API 기능을 되살리기 위한 최소 이식입니다.
- Express 원본(`server.js`)은 로컬/기존 환경용으로 유지됩니다.
