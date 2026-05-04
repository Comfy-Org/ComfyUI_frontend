---
name: add-model-page
description: 'Add, update, or remove a model page entry in ComfyUI_frontend. Triggered by Glary-Bot Slack commands. Creates a PR to Comfy-Org/ComfyUI_frontend with the change and posts a Vercel preview link back to Slack.'
---

# add-model-page

Handle Glary-Bot Slack commands that add, update, or remove model pages in the ComfyUI website.

## Trigger phrases

- `@Glary-Bot Add a model page for <model-name>`
- `@Glary-Bot Update the model page for <model-name>`
- `@Glary-Bot Remove <model-name> from model pages`

## Repos involved

- **comfy-router** (this repo): skill lives here, no code changes needed
- **ComfyUI_frontend** (`Comfy-Org/ComfyUI_frontend`): all file edits happen here

Assume ComfyUI_frontend is checked out at a sibling path. Find it:

```bash
find ~ -maxdepth 5 -name "models.ts" -path "*/website/src/config/*" 2>/dev/null | head -1
```

Set `FRONTEND` to that repo root (parent four levels up from the found path).

Key files inside `$FRONTEND`:

| File | Purpose |
|------|---------|
| `apps/website/src/config/models.ts` | Model array |
| `apps/website/src/i18n/translations.ts` | i18n string map |
| `apps/website/scripts/generate-models.ts` | Derives model data from workflow templates |

---

## Phase 1 — Parse the request

Extract:
- **action**: `add` | `update` | `remove`
- **model-name**: raw string from Slack (e.g. `flux1-schnell`, `flux1_dev.safetensors`)

Normalize to a slug: lowercase, replace `_` and `.` with `-`, strip `.safetensors` suffix.
Example: `flux1_dev.safetensors` → `flux1-dev`

---

## Phase 2 — Gather model data (ADD / UPDATE)

Run the generator to find the model:

```bash
cd $FRONTEND
pnpm tsx apps/website/scripts/generate-models.ts \
  | jq '.[] | select(.name | ascii_downcase | contains("MODEL_NAME"))'
```

Replace `MODEL_NAME` with the normalized slug (use `-` as wildcard-friendly substring).

The output object contains:
- `name` — exact filename (e.g. `flux1_dev.safetensors`) or display name for partner nodes
- `url` — HuggingFace download URL → use as `huggingFaceUrl` (empty `''` for partner nodes)
- `directory` — model subdirectory (e.g. `diffusion_models`) or `partner_nodes` for API models
- `workflowCount` — integer
- `suggestedSlug` — use this as `slug` if reasonable
- `suggestedDisplayName` — use as seed for i18n `displayName`

If the generator returns no match and the model is a known API/partner model (e.g. Kling AI, Meshy AI, Nano Banana), add it manually as `directory: 'partner_nodes'` — no HuggingFace URL needed. Otherwise, tell the user the model was not found and stop.

---

## Phase 3 — Check for existing entry

```bash
grep -n "slug: '${SLUG}'" $FRONTEND/apps/website/src/config/models.ts
```

- Match found + action is `add` → switch to UPDATE flow automatically; inform the user
- No match + action is `update` → stop and tell the user

---

## Phase 4A — ADD: insert new entry

### 4A.1 Build the entry

```typescript
{
  slug: 'MODEL-SLUG',
  name: 'model_name.safetensors',          // or display name for partner nodes
  displayName: 'models.MODEL-SLUG.displayName' as TranslationKey,
  description: 'models.MODEL-SLUG.description' as TranslationKey,
  directory: 'diffusion_models',           // from generate-models; or 'partner_nodes' for API models
  huggingFaceUrl: 'https://huggingface.co/...',  // from generate-models; use '' for partner nodes
  docsUrl: 'https://docs.comfy.org/...',   // optional: tutorial link on docs.comfy.org
  blogUrl: 'https://blog.comfy.org/...',   // optional: blog post link
  ogImage: '/images/models/MODEL-SLUG-og.png',
  thumbnail: '/images/models/MODEL-SLUG-thumb.webp',
  featured: true,
  workflowCount: N,                        // from generate-models output
  tags: ['tag1', 'tag2'] as const,         // derive from slug tokens
  publishedDate: 'YYYY-MM-DD',             // today
  modifiedDate: 'YYYY-MM-DD',              // today
}
```

Tags: split the slug on `-`, drop pure numeric tokens, keep meaningful words.

### 4A.2 Insert into models array

The array in `apps/website/src/config/models.ts` is sorted by `workflowCount` descending. Find the first entry whose `workflowCount` is less than the new entry's count and insert before it. If all are greater, append at the end.

### 4A.3 Add i18n keys

In `apps/website/src/i18n/translations.ts`, find the closing `}` of the `translations` object (the line before `} as const satisfies`). Insert before it:

```typescript
  'models.MODEL-SLUG.displayName': {
    en: 'Human Display Name',
    'zh-CN': ''
  },
  'models.MODEL-SLUG.description': {
    en: 'SEO description: one sentence explaining what this model does.',
    'zh-CN': ''
  },
```

Use `suggestedDisplayName` from generate-models for the English `displayName`. Write a concise one-sentence English `description` based on the model name and directory.

---

## Phase 4B — UPDATE: edit existing entry

Find the entry by slug. Apply only the fields the user explicitly requested changing. Update `modifiedDate` to today. Leave all other fields unchanged.

---

## Phase 4C — REMOVE: delete entry

1. Remove the entire object literal (including trailing comma) from the `models` array.
2. Remove the two translation keys (`displayName` and `description`) from `translations.ts`.
3. Note in the PR description why the model was removed (quote the Slack request).

---

## Phase 5 — Verify TypeScript

```bash
cd $FRONTEND
pnpm typecheck 2>&1 | grep -E "error|warning" | head -20
```

Fix any type errors before proceeding. Common issues:
- Missing `as TranslationKey` cast on `displayName`/`description`
- New translation key not yet present in `translations` when models.ts references it (add key first)

---

## Phase 6 — Create PR

```bash
cd $FRONTEND
BRANCH="glary/add-model-page-MODEL-SLUG"   # or update- / remove-
git checkout -b $BRANCH
git add apps/website/src/config/models.ts apps/website/src/i18n/translations.ts
git commit -m "feat(models): add model page for MODEL-SLUG"
git push -u origin $BRANCH
gh pr create \
  --title "Add model page: MODEL-SLUG" \
  --body "$(cat <<'EOF'
Adds a new model page entry for MODEL-SLUG.

Triggered by Glary-Bot from Slack: "<paste original Slack message>"

## Changes
- `models.ts`: new entry with workflowCount N, directory DIRECTORY
- `translations.ts`: placeholder i18n keys (zh-CN needs translation)

## Images needed
- `/images/models/MODEL-SLUG-og.png` (1200×630)
- `/images/models/MODEL-SLUG-thumb.webp`

cc @design-team for images
EOF
)"
```

For UPDATE use branch `glary/update-model-page-MODEL-SLUG`. For REMOVE use `glary/remove-model-page-MODEL-SLUG` and remove the images note.

---

## Phase 7 — Post Vercel preview to Slack

After the PR is created, fetch the Vercel preview URL:

```bash
# Wait ~60s for Vercel bot to comment, then:
gh pr view $BRANCH --json comments \
  --jq '.comments[].body | select(contains("vercel.app"))' | grep -o 'https://[^ )]*vercel.app[^ )]*' | head -1
```

Post back to the original Slack thread:

> PR created: <PR_URL>
> Preview: <VERCEL_PREVIEW_URL>/models/MODEL-SLUG
> Please review and approve. Once merged, the page will be live at comfy.org/models/MODEL-SLUG.
> Note: OG image and thumbnail still needed — tagged design team in the PR.

If the Vercel URL is not available within 2 minutes, post the PR URL alone and note the preview is pending.

---

## Error states

| Situation | Response |
|-----------|----------|
| Model not in workflow templates | "I couldn't find MODEL-NAME in the workflow templates. Check the spelling or ask an engineer to add it to `workflow_templates/templates/`." |
| Slug already exists (add) | Automatically switch to update flow; tell the user. |
| Slug not found (update/remove) | "There's no model page for MODEL-SLUG yet. Did you mean to add one?" |
| Typecheck fails | Fix the error, do not push a broken PR. |
| `generate-models.ts` errors | Share the error output in Slack and stop. |
