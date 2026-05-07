# Dialog Migration — Phase 1 Scope

Status: Draft (in review)
Owner: jaewon@comfy.org
Parent: [FE-571](https://linear.app/comfyorg/issue/FE-571/dialog-system-migration-primevue-reka-ui-parent)
This phase: [FE-573](https://linear.app/comfyorg/issue/FE-573/phase-1-migrate-promptdialogcontent-confirmationdialogcontent-closes-11688)
Predecessor: PR #11719 (Phase 0, merged at `0788e7139`)
Related: `temp/plans/dialog-migration-phase-0.md`, `temp/plans/adr-0009-dialog-reka-migration-DRAFT.md`

## Goal

Migrate the two simplest production dialogs — `PromptDialogContent` and `ConfirmationDialogContent` — from the PrimeVue `Dialog` renderer onto the Reka-UI primitive set landed in Phase 0. After Phase 1:

- `useDialogService().prompt(...)` and `useDialogService().confirm(...)` render through `<DialogContent size="md">` (max-width 36rem) instead of the unbounded PrimeVue dialog.
- The PrimeVue `Message` import inside `ConfirmationDialogContent.vue` is gone; the component is PrimeVue-free.
- The ergonomics surfaced in #11688 (already closed manually after Phase 0 merged) become the actual user-visible fix shipped in this PR.
- `dialogService` public API (`prompt`, `confirm`, `showBillingComingSoonDialog`) is unchanged — every existing caller, including `app.extensionManager.dialog.*` extensions, keeps working with no source change.

## Why this scope

These two dialogs are the right first migration:

1. **Smallest content surface** — `PromptDialogContent` is 43 LOC; `ConfirmationDialogContent` is 158 LOC and the only PrimeVue dependency inside it is the `<Message>` info banner.
2. **Closes the #11688 ergonomics bug** — the PrimeVue `Dialog` had no max-width, which was the original reporter complaint. The Reka primitive's `md` default (`max-w-xl` = 36rem) is exactly the proposed fix.
3. **Known callers** — only three call sites:
   - `dialogService.prompt()` (line 216)
   - `dialogService.confirm()` (line 259)
   - `dialogService.showBillingComingSoonDialog()` (line 548)
4. **Renderer branch is already proven** — Phase 0 added `renderer: 'reka'` opt-in to the dialog stack; this PR just flips that flag for the three call sites and removes the PrimeVue-isms inside the content components.

## In scope

### 1. `PromptDialogContent.vue`

- No template change required — the component already uses our `Button` and `Input` primitives, not PrimeVue.
- Verify that `autofocus`, `selectAll()` on focus, and `keyup.enter` still work inside the Reka `DialogContent` focus trap. Reka-UI's `DialogContent` auto-focuses the first focusable descendant on open; that should be the `Input`, matching today's behavior.
- Add a Cancel button (or rely on `DialogClose` in the header) so dismissal is keyboard- and mouse-discoverable; today the only dismissal path is ESC / backdrop. (Optional — punt if review prefers no behavior change.)

### 2. `ConfirmationDialogContent.vue`

- **Replace `<Message>` from `primevue/message`** with a Tailwind-only inline alert. Keep the `pi pi-info-circle` icon and the existing `text-muted-foreground`-style severity. No new component file required; ~10 LOC inline.
- Remove the `import Message from 'primevue/message'` line.
- Drop `PrimeVue` from `ConfirmationDialogContent.test.ts`'s `global.plugins` array; the component will no longer require it.
- All button variants and the `i18n-t` "do not ask again" link stay as-is.

### 3. `dialogService.ts`

Flip the `renderer` flag on the three call sites:

```ts
// prompt()
dialogComponentProps: {
  renderer: 'reka',
  size: 'md',
  onClose: () => resolve(null)
}

// confirm()
dialogComponentProps: {
  renderer: 'reka',
  size: 'md',
  onClose: () => resolve(null)
}

// showBillingComingSoonDialog()
dialogComponentProps: {
  renderer: 'reka',
  size: 'sm',
  class: 'max-w-[360px]'   // replaces the existing pt.root.class override
}
```

`size` is explicit even where it equals the default to make the intent reviewable.

The existing PrimeVue `pt: { root: { class: 'max-w-[360px]' } }` on `showBillingComingSoonDialog` cannot apply on the Reka path; it must be reauthored as a top-level `class` (or `pt`-equivalent slot prop on `DialogContent`) — confirm the wiring path in `GlobalDialog.vue` before locking the API.

### 4. Tests

#### Unit
- `PromptDialogContent.test.ts` — no change expected. Keep behavioral coverage as-is (Enter submits, click submits, defaultValue prefill, selectAll on focus).
- `ConfirmationDialogContent.test.ts` — drop `PrimeVue` plugin import; one new behavioral test covering each `type` branch's button surface (`default`, `delete`, `overwrite`, `dirtyClose`, `info`) since we have only one happy-path test today.
- New `GlobalDialog.test.ts` case (light) — when `dialogService.prompt()` is invoked, the stack item carries `renderer: 'reka'` and `size: 'md'`. This is a regression net for the renderer flip.

#### E2E (Playwright)
- Existing: `browser_tests/tests/confirmDialogTextWrap.spec.ts` (`@mobile`) already covers a 200-char unbreakable filename. Re-run on the migrated path; expectation is still "Confirm and Cancel buttons are visible and in viewport." Update selector if `confirmDialog.root` was tied to `.p-dialog`.
- New: one desktop spec asserting the rendered confirmation dialog content `max-width <= 36rem + safe slack` after the migration. This is the regression test for #11688.

### 5. Storybook
- No new stories required. The Phase 0 `Dialog.stories.ts` covers `Default | LongContent | Headless | AllSizes`. Verify the migrated dialogs render correctly in the Storybook **PrimeVue → Reka** comparison story (add side-by-side if reviewers want it; otherwise out of scope).

## Out of scope (deferred to later phases)

- Migrating `ErrorDialogContent`, `NodeSearchBox`, `SecretFormDialog`, `VideoHelpDialog`, `CustomizationDialog` — Phase 2 (FE-574).
- Migrating Settings dialog — Phase 3 (FE-575).
- Migrating Manager dialog — Phase 4 (FE-576).
- Migrating `ConfirmDialog` callers (`SecretsPanel`, `BaseWorkflowsSidebarTab`) — Phase 5 (FE-577).
- Removing PrimeVue `Dialog`/`ConfirmDialog` imports + cleaning the `<style>` overrides on `GlobalDialog.vue` — Phase 6 (FE-578).
- Touching legacy `ComfyDialog` (`src/scripts/ui/dialog.ts`).
- Deduplicating `Dialogue.vue` / `ImageLightbox.vue`.

## API contract impact

Public:

- `useDialogService().prompt({ title, message, defaultValue, placeholder })` — unchanged signature, unchanged return type (`Promise<string | null>`).
- `useDialogService().confirm({ title, message, type, itemList, hint })` — unchanged.
- `app.extensionManager.dialog.*` — unchanged. Custom-node extensions calling these continue to work because the renderer choice is internal.

Internal:

- `DialogComponentProps.renderer` flips from `'primevue'` (Phase 0 default) to `'reka'` for three call sites only.
- `DialogComponentProps.size` becomes a meaningful field on these three call sites.
- `DialogComponentProps.class` is read on the Reka path for `showBillingComingSoonDialog`'s width override (verify support in `GlobalDialog.vue` — if not, add a one-line forwarder, ~3 LOC).

## Acceptance criteria

- [ ] `pnpm typecheck` clean.
- [ ] `pnpm lint` clean (no new warnings).
- [ ] `pnpm test:unit` green; `ConfirmationDialogContent.test.ts` no longer imports `PrimeVue`.
- [ ] `pnpm test:browser:local --grep "@mobile.*confirm"` green on the migrated path.
- [ ] No PrimeVue import remains in `PromptDialogContent.vue` or `ConfirmationDialogContent.vue`.
- [ ] `dialogService.ts` `prompt()`, `confirm()`, and `showBillingComingSoonDialog()` set `renderer: 'reka'`.
- [ ] Manual visual diff (Storybook + dev server): prompt and confirm dialogs render at ≤36rem on a 1920×1080 viewport, in contrast to the previously unbounded width.
- [ ] No production dialog *outside* the three migrated call sites visually changes (Phase 0's PrimeVue default remains in effect for everyone else).
- [ ] Bundle size delta < +2 KB gzipped (we are only flipping flags + replacing one PrimeVue `<Message>`).
- [ ] PR body includes before/after screenshots of `prompt` and `confirm` on a wide viewport (per memory: bug-fix PRs need real visual repro).

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Reka focus-trap behaves differently from PrimeVue, breaking `autofocus` on the `Input` inside `PromptDialogContent` | Add a Vitest assertion that the input is the active element after open; manual keyboard QA before merge |
| `showBillingComingSoonDialog` width regresses because the existing `pt.root.class: 'max-w-[360px]'` override doesn't apply on the Reka path | Replace with `class` or `size: 'sm'`; verify rendered max-width in DOM during QA |
| `Message` replacement loses semantic role / a11y signal | Use `role="status"` (matches PrimeVue `Message severity="secondary"`) and keep the `pi-info-circle` icon |
| Stack collision: both `prompt()` and `confirm()` use `key: 'global-prompt'` — pre-existing on `main`, but a switch in renderer might surface latent ordering bugs | Out of scope — flag for a follow-up cleanup ticket if observed during QA |
| ESC / backdrop dismissal semantics differ between renderers | Phase 0 already wired `closeOnEscape` → `escape-key-down` and `dismissableMask` → `pointer-down-outside`; rely on the existing wiring without adding new knobs |
| The `confirmDialogTextWrap` spec selectors are tied to `.p-dialog-*` class names | Audit `comfyPage.confirmDialog` fixture; update to a renderer-agnostic locator (`role="dialog"` + accessible name) before flipping the flag |

## Estimated size

| Bucket | Approx LOC |
| --- | --- |
| `dialogService.ts` flag flips | ~12 |
| `ConfirmationDialogContent.vue` (`<Message>` removal + replacement) | ~15 |
| `PromptDialogContent.vue` (optional Cancel button) | ~8 |
| Test updates (unit + e2e) | ~80 |
| `GlobalDialog.vue` `class` forwarder if needed | ~5 |
| **Total non-test** | **~40** |
| **Total test** | **~80** |
| **Grand total** | **~120 LOC** (under the 250 LOC published estimate) |

Single PR. Reviewable in one sitting.

## Sequencing inside this PR

1. `dialogService.ts` flag flips behind a temporary local-only feature gate (so the renderer flip can be tested in isolation per dialog without affecting the others mid-review). Drop the gate before merge.
2. Replace PrimeVue `<Message>` in `ConfirmationDialogContent.vue` and update its test.
3. Verify `showBillingComingSoonDialog` width override on the Reka path; add `class` forwarding to `GlobalDialog.vue` only if necessary.
4. E2E selector audit (`confirmDialogTextWrap.spec.ts` + `comfyPage.confirmDialog` fixture).
5. Manual visual QA on `pnpm dev` — capture screenshots for PR body.
6. Lint / typecheck / test gates.

## Roadmap reminder (unchanged)

| Phase | Status | Linear | Scope |
| --- | --- | --- | --- |
| 0 | ✅ Merged (#11719) | FE-572 | Reka-UI primitive set + opt-in renderer branch |
| **1 (this doc)** | 📝 Plan | **FE-573** | **Migrate `PromptDialogContent` + `ConfirmationDialogContent`; ships #11688 fix** |
| 2 | 📋 Backlog | FE-574 | `ErrorDialogContent`, `NodeSearchBox`, `SecretFormDialog`, `VideoHelpDialog`, `CustomizationDialog` |
| 3 | 📋 Backlog | FE-575 | Settings dialog (workspace + non-workspace) |
| 4 | 📋 Backlog | FE-576 | Manager dialog |
| 5 | 📋 Backlog | FE-577 | `ConfirmDialog` callers (`SecretsPanel`, `BaseWorkflowsSidebarTab`) |
| 6 | 📋 Backlog | FE-578 | Remove PrimeVue Dialog/ConfirmDialog imports + clean `<style>` overrides |
