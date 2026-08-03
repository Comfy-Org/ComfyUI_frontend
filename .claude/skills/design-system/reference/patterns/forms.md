# Forms

There is no shared `Form` wrapper component. Forms are hand-assembled from `ui/` primitives (`Input`, `Textarea`, `SingleSelect`, `MultiSelect`, `Switch`, `Button`) inside a `flex flex-col` container. Two layout shapes recur, depending on context — pick based on where the form lives.

## Shape 1: dialog / stacked form

Used for dialog-hosted forms (create/edit flows). Label sits above the control.

```
<form class="flex flex-col gap-4 px-4 py-2">
  <div class="flex flex-col gap-1">
    <label class="text-sm font-medium">Name</label>
    <Input v-model="form.name" :class="{ ... }" />
    <small v-if="errors.name" class="text-red-500">{{ errors.name }}</small>
    <small v-else class="text-muted-foreground">Optional hint text.</small>
  </div>
  <!-- more fields -->
</form>
```

- Field block: `flex flex-col gap-1` (label, control, help/error line).
- Between fields: `gap-4`. Between sectioned groups: `gap-6`.
- Footer: `flex justify-end gap-2 py-2` — **Cancel first (left), submit action second (right)**, submit uses `:loading="isSubmitting"`.
- Real examples: `src/platform/secrets/components/SecretFormDialog.vue`, `src/platform/workflow/sharing/components/profile/ComfyHubCreateProfileForm.vue`.

## Shape 2: settings row (label-left, control-right)

Used for dense settings panels (app Settings dialog, server config). One row per setting, label on the left, control right-aligned.

```
<div class="flex min-h-8 flex-row items-center gap-2">
  <div class="flex grow">Setting label</div>
  <div class="flex justify-end">
    <Switch v-model="value" />
  </div>
</div>
```

- Reference implementation: `src/components/common/FormItem.vue` — a generic settings-row component that swaps in `Switch`/`SingleSelect`/`FormattedNumberStepper`/etc. based on a `type` discriminator. Reuse this shape (not necessarily the component itself) whenever building a settings list.

## Validation

- No visual "required" asterisk convention exists in this codebase — required-ness is communicated by conditionally rendering the field, placeholder copy, or simply expecting the field to always be filled. Don't invent an asterisk system unless the user asks for one.
- Inline error: a `<small>`/`<p>` line below the control, styled `text-red-500` (or the equivalent `text-destructive-background` semantic token), replacing the muted hint text when an error is present.
- On select/input components that support it, set `invalid` (e.g. `SingleSelect`) or `aria-invalid` rather than hand-rolling a red border.

## Buttons

- Cancel/secondary action is always **left** of the primary/submit action in the footer.
- Submit/primary action uses `variant="primary"` (or `variant="destructive"` if the form submission itself is destructive) and drives its `loading` state from the async submit call — never disable-without-feedback during a submit.

## Do

- Reuse `FormItem`'s label-left/control-right shape for settings panels; use the stacked label-above-input shape for dialog forms.
- Surface async submit state via `Button`'s `loading` prop.

## Don't

- Don't build a new generic `<Form>` abstraction — this codebase deliberately hand-assembles forms per-feature from primitives.
- Don't invent a required-field asterisk convention that doesn't exist elsewhere in the product.
