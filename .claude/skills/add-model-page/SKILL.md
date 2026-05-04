---
name: add-model-page
description: 'Add, update, or remove a model page entry on the comfy org website. Creates a PR to Comfy-Org/ComfyUI_frontend apps/website folder with the change.'
---

# add-model-page

Add, update, or remove model pages in the ComfyUI website.

## Trigger phrases

- `Add a model page for <model-name>`
- `Update the model page for <model-name>`
- `Remove <model-name> from model pages`

---

## Phase 1 — Parse the request

Extract:

- **action**: `add` | `update` | `remove`
- **model-name**: raw string (e.g. `flux1-schnell`, `flux1_dev.safetensors`)

Normalize to a slug: lowercase, replace `_` and `.` with `-`, strip file extensions.
Example: `flux1_dev.safetensors` → `flux1-dev`

---

## Phase 2 — Gather model data (ADD / UPDATE)

Find the ComfyUI_frontend repo root. Key files:

| File                                      | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `apps/website/src/config/models.ts`       | Model array                                |
| `apps/website/src/i18n/translations.ts`   | i18n string map                            |
| `apps/website/scripts/generate-models.ts` | Derives model data from workflow templates |

Run the generator to find the model:

```bash
cd ComfyUI_frontend
pnpm tsx apps/website/scripts/generate-models.ts \
  | jq '.[] | select(.name | ascii_downcase | contains("MODEL_NAME"))'
```

Replace `MODEL_NAME` with the normalized slug (substring match).

The output object contains:

- `name` — exact filename (e.g. `flux1_dev.safetensors`) or display name for partner nodes
- `url` — HuggingFace download URL → use as `huggingFaceUrl` (empty `''` for partner nodes)
- `directory` — model subdirectory (e.g. `diffusion_models`) or `partner_nodes` for API models
- `workflowCount` — integer
- `suggestedSlug` — use this as `slug` if reasonable
- `suggestedDisplayName` — use as seed for i18n `displayName`

If the generator returns no match and the model is a known API/partner model, add it
manually as `directory: 'partner_nodes'` with an empty `huggingFaceUrl`.

---

## Phase 3 — Check for existing entry

```bash
grep -n "slug: '${SLUG}'" apps/website/src/config/models.ts
```

- Match found + action is `add` → switch to UPDATE flow automatically
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
  directory: 'diffusion_models',           // from generate-models; or 'partner_nodes'
  huggingFaceUrl: 'https://huggingface.co/...',  // empty '' for partner nodes
  docsUrl: 'https://docs.comfy.org/...',   // optional: tutorial link
  blogUrl: 'https://blog.comfy.org/...',   // optional: blog post link
  ogImage: '/images/models/MODEL-SLUG-og.png',
  thumbnail: '/images/models/MODEL-SLUG-thumb.webp',
  featured: true,
  workflowCount: N,
  tags: ['tag1', 'tag2'] as const,
  publishedDate: 'YYYY-MM-DD',
  modifiedDate: 'YYYY-MM-DD',
}
```

Tags: split the slug on `-`, drop pure numeric tokens, keep meaningful words.

### 4A.2 Insert into models array

The array in `apps/website/src/config/models.ts` is sorted by `workflowCount`
descending. Find the first entry whose `workflowCount` is less than the new
entry's count and insert before it. If all are greater, append at the end.

### 4A.3 Add i18n keys

In `apps/website/src/i18n/translations.ts`, find the line before
`} as const satisfies` and insert:

```typescript
  'models.MODEL-SLUG.displayName': {
    en: 'Human Display Name',
    'zh-CN': ''
  },
  'models.MODEL-SLUG.description': {
    en: 'One sentence describing what this model does.',
    'zh-CN': ''
  },
```

Use `suggestedDisplayName` from generate-models for the English `displayName`.

---

## Phase 4B — UPDATE: edit existing entry

Find the entry by slug. Apply only the fields requested. Update `modifiedDate` to
today. Leave all other fields unchanged.

---

## Phase 4C — REMOVE: delete entry

1. Remove the entire object literal (including trailing comma) from the `models` array.
2. Remove the two translation keys from `translations.ts`.
3. Note in the PR description why the model was removed.

---

## Phase 5 — Verify TypeScript

```bash
pnpm typecheck 2>&1 | grep -E "error|warning" | head -20
```

Fix any type errors before proceeding. Common issues:

- Missing `as TranslationKey` cast on `displayName`/`description`
- New translation key not yet in `translations.ts` when `models.ts` references it

---

## Phase 6 — Create PR

```bash
BRANCH="add-model-page-MODEL-SLUG"   # or update- / remove-
git checkout -b $BRANCH
git add apps/website/src/config/models.ts apps/website/src/i18n/translations.ts
git commit -m "feat(models): add model page for MODEL-SLUG"
git push -u origin $BRANCH
gh pr create \
  --title "Add model page: MODEL-SLUG" \
  --body "$(cat <<'EOF'
Adds a new model page entry for MODEL-SLUG.

## Changes
- `models.ts`: new entry with workflowCount N, directory DIRECTORY
- `translations.ts`: placeholder i18n keys (zh-CN needs translation)

## Images needed
- `/images/models/MODEL-SLUG-og.png` (1200×630)
- `/images/models/MODEL-SLUG-thumb.webp`
EOF
)"
```

For UPDATE use branch `update-model-page-MODEL-SLUG`.
For REMOVE use `remove-model-page-MODEL-SLUG` and omit the images note.

---

## Error states

| Situation                       | Response                                                         |
| ------------------------------- | ---------------------------------------------------------------- |
| Model not in workflow templates | Ask user to verify spelling or add it manually as a partner node |
| Slug already exists (add)       | Switch to update flow automatically                              |
| Slug not found (update/remove)  | Stop and ask user to confirm                                     |
| Typecheck fails                 | Fix the error before pushing                                     |
