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

## Architecture overview

Models come from two sources merged at build time:

| File | Purpose |
|------|---------|
| `apps/website/src/config/generated-models.json` | Auto-generated from workflow_templates (slug, name, directory, huggingFaceUrl, workflowCount, displayName) |
| `apps/website/src/config/model-metadata.ts` | Hand-curated overrides (docsUrl, blogUrl, featured) — only add entries that need overrides |
| `apps/website/src/config/models.ts` | Merges the two above; exports typed `Model[]` |

To regenerate the JSON from workflow_templates:

```bash
cd ComfyUI_frontend
pnpm tsx apps/website/scripts/generate-models.ts
```

This writes `apps/website/src/config/generated-models.json` directly.

---

## Phase 2 — Gather model data (ADD / UPDATE)

Run the generator to get fresh data, then find the model:

```bash
cd ComfyUI_frontend
pnpm tsx apps/website/scripts/generate-models.ts
jq '.[] | select(.slug | contains("MODEL_SLUG"))' \
  apps/website/src/config/generated-models.json
```

The JSON fields are:
- `slug` — URL slug
- `name` — exact filename or display name for partner nodes
- `huggingFaceUrl` — download URL (empty for partner nodes)
- `directory` — `diffusion_models` | `loras` | … | `partner_nodes`
- `workflowCount` — integer
- `displayName` — human-readable name

If no match and it is a known API/partner model, add it to `API_PROVIDER_MAP` in
`generate-models.ts` and re-run. Otherwise tell the user.

---

## Phase 3 — Check for existing entry

```bash
grep -n "slug: '${SLUG}'" apps/website/src/config/models.ts
```

- Match found + action is `add` → switch to UPDATE flow automatically
- No match + action is `update` → stop and tell the user

---

## Phase 4A — ADD: new partner/API model not in workflow_templates

For partner nodes (no local file), add an entry to `API_PROVIDER_MAP` in
`apps/website/scripts/generate-models.ts`:

```typescript
mymodel: { name: 'My Model', slug: 'my-model' },
```

Then re-run `pnpm tsx apps/website/scripts/generate-models.ts` — it will appear
in `generated-models.json` automatically.

If you also want a `docsUrl` or `blogUrl`, add an entry to `model-metadata.ts`:

```typescript
'my-model': {
  docsUrl: 'https://docs.comfy.org/tutorials/...',
  blogUrl: 'https://blog.comfy.org/...',
  featured: true
}
```

No changes to `models.ts` or `translations.ts` are needed.

---

## Phase 4B — UPDATE: edit existing entry

Only `model-metadata.ts` needs editing for most updates (docsUrl, blogUrl,
featured). For `displayName` or `directory` changes, edit the entry directly in
`generated-models.json` (until the next generator run would overwrite it — then
fix the source in `generate-models.ts`).

---

## Phase 4C — REMOVE: delete entry

Remove the entry from `generated-models.json` (or mark it with `canonicalSlug`
pointing to the replacement). No translation file changes needed.

---

## Phase 5 — Verify TypeScript

```bash
pnpm typecheck 2>&1 | grep -E "error|warning" | head -20
```

Fix any type errors before proceeding. Common issues:
- `ModelDirectory` type not matching a new `directory` value — add it to the union
- JSON import shape mismatch — `generated-models.json` must match `OutputModel`

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

| Situation | Response |
|-----------|----------|
| Model not in workflow templates | Ask user to verify spelling or add it manually as a partner node |
| Slug already exists (add) | Switch to update flow automatically |
| Slug not found (update/remove) | Stop and ask user to confirm |
| Typecheck fails | Fix the error before pushing |
