# ComfyUI Frontend Preview — Cloudflare Pages Deployment

Deploy the ComfyUI frontend to `comfy-ui.pages.dev` with a connection panel
for users to connect to their local (or remote) ComfyUI backend.

---

## Plan

### Phase 1: Build Metadata & CI Pipeline

- [x] Plan: track everything in `TODO.md` (bujo)
- [x] `global.d.ts`: declare new CI build-time constants
- [x] `eslint.config.ts`: register CI globals as `readonly`
- [x] `vite.config.mts`: inject CI env vars (`__CI_BRANCH__`, `__CI_PR_NUMBER__`, `__CI_RUN_ID__`, `__CI_JOB_ID__`)
- [x] `.github/workflows/ci-deploy-preview.yaml`: build + deploy to CF Pages on every push/PR
- [x] `scripts/cicd/pr-preview-deploy-and-comment.sh`: deploy script + PR comment (follows storybook pattern)

### Phase 2: ConnectionPanel Component

- [x] `src/views/ConnectionPanelView.vue`: standalone connection/setup page
  - [x] Build info badge (PR/branch, commit SHA tooltip, job ID, action ID, base version from `package.json`)
  - [x] Backend URL input (default `http://127.0.0.1:8188/`, saved in localStorage)
  - [x] Test button: HTTP (`GET /api/system_stats`) + WebSocket (`ws://host/ws`)
  - [x] Connection status indicators (HTTP ✓/✗, WS ✓/✗)
  - [x] Command-line guide to run ComfyUI with CORS enabled
  - [x] Local network permission guidance
- [x] `src/locales/en/main.json`: i18n strings for connection panel

### Phase 3: Router Integration

- [x] `src/router.ts`: add `/connect` route for ConnectionPanelView

### Phase 4: Tests

- [x] `src/views/ConnectionPanelView.test.ts`: unit tests (8/8 passing)

### Phase 5: Verification

- [x] `pnpm typecheck` — ✅ passed
- [x] `pnpm lint` — ✅ passed
- [x] `pnpm test:unit -- src/views/ConnectionPanelView.test.ts` — ✅ 8/8 passed

---

## Files Changed/Created

| File                                            | Action                                     |
| ----------------------------------------------- | ------------------------------------------ |
| `TODO.md`                                       | created                                    |
| `.github/workflows/ci-deploy-preview.yaml`      | created                                    |
| `scripts/cicd/pr-preview-deploy-and-comment.sh` | created                                    |
| `src/views/ConnectionPanelView.vue`             | created                                    |
| `src/views/ConnectionPanelView.test.ts`         | created                                    |
| `src/locales/en/main.json`                      | modified (added `connectionPanel` section) |
| `src/router.ts`                                 | modified (added `/connect` route)          |
| `global.d.ts`                                   | modified (added `__CI_*` declarations)     |
| `vite.config.mts`                               | modified (added `__CI_*` defines)          |
| `eslint.config.ts`                              | modified (added `__CI_*` globals)          |

## Log

- `[2026-04-10]` Created plan, implemented all phases, all checks passing
