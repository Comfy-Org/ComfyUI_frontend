# Mock Marketplace API

A Bun-based mock server for the Template Marketplace API endpoints. Uses in-memory storage with seed data that resets on restart.

## Running

Start the mock API:

```bash
pnpm mock:marketplace
```

This starts a server on `http://localhost:4000` (override with `MOCK_MARKETPLACE_PORT` env var).

## Using with the frontend dev server

Run the frontend with marketplace proxy enabled:

```bash
pnpm mock:marketplace  # terminal 1
pnpm dev:marketplace   # terminal 2
```

`pnpm dev:marketplace` sets `DEV_SERVER_MARKETPLACE_URL=http://localhost:4000`, which tells Vite to proxy `/api/marketplace/**` requests to the mock server. All other `/api/**` requests still go to `DEV_SERVER_COMFYUI_URL`.

## Endpoints

| Method | Path                                        | Description                             |
| ------ | ------------------------------------------- | --------------------------------------- |
| POST   | `/api/marketplace/templates`                | Create a draft template                 |
| PUT    | `/api/marketplace/templates/:id`            | Update a template                       |
| POST   | `/api/marketplace/templates/:id/submit`     | Submit draft for review                 |
| POST   | `/api/marketplace/templates/:id/approve`    | Approve (reviewer)                      |
| POST   | `/api/marketplace/templates/:id/reject`     | Reject (reviewer)                       |
| POST   | `/api/marketplace/templates/:id/unpublish`  | Unpublish approved template             |
| POST   | `/api/marketplace/templates/:id/media`      | Upload media (FormData)                 |
| GET    | `/api/marketplace/media/seed/*`             | Static placeholder images for seed data |
| GET    | `/api/marketplace/author/templates`         | List author's templates                 |
| GET    | `/api/marketplace/author/stats?period=week` | Author stats                            |
| GET    | `/api/marketplace/categories`               | List categories                         |
| GET    | `/api/marketplace/tags/suggest?query=...`   | Tag suggestions                         |
| POST   | `/api/marketplace/_reset`                   | Reset DB to seed state                  |
| GET    | `/review`                                   | Temp UI for testing approve/reject flow |

## Review UI

A temporary HTML UI at `http://localhost:4000/review` lists all workflows (templates), highlights those in `pending_review`, and provides Approve/Reject buttons. Use it to manually test the review flow when running `pnpm mock:marketplace`.

## Status transitions

```
draft → pending_review → approved → unpublished
                       → rejected → pending_review
```

## Testing

Tests run as part of the standard Vitest suite:

```bash
pnpm vitest run tools/mock-marketplace-api/
```

## Seed media

Placeholder images for seeded templates live in `seed-media/`:

- `seed-media/thumbs/` – template thumbnails (e.g. `portrait.png`, `gif.png`)
- `seed-media/previews/` – workflow preview images

Replace the default 1×1 pixel placeholders with real images as needed. Seed data in `state.ts` references these via `/api/marketplace/media/seed/thumbs/...` and `/api/marketplace/media/seed/previews/...`.

## Shared types

API types are defined in `src/platform/marketplace/apiTypes.ts` and imported by both the frontend and this mock server. Edit that file to change the contract.

## Diagrams

Diagrams are in [docs/diagrams.md](docs/diagrams.md):

- Endpoint summary table
- Template status flow
- Media upload sequence
