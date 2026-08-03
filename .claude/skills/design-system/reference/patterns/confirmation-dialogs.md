# Confirmation / Destructive-Action Dialogs

Built from `ui/dialog/*` (see `components/dialog.md`). Two coexisting shapes — both agree on button order and styling.

## Structure

- Title (`DialogTitle` or a plain `<h2>`): names the action, e.g. "Delete workspace".
- Body (`DialogDescription` or `<p class="text-sm text-muted-foreground">`): one sentence naming the specific target being affected (interpolate the item's name — don't say "this item").
- Footer: `flex items-center justify-end gap-4 p-4` (or `DialogFooter`) — **Cancel/secondary on the left, the destructive action on the right**, both typically `size="lg"`.

```vue
<div class="flex items-center justify-end gap-4 p-4">
  <Button variant="muted-textonly" @click="onCancel">{{ $t('g.cancel') }}</Button>
  <Button variant="destructive" size="lg" :loading="isDeleting" @click="onDelete">
    {{ $t('g.delete') }}
  </Button>
</div>
```

- Real examples: `src/platform/workspace/components/dialogs/DeleteWorkspaceDialogContent.vue`, `RemoveMemberDialogContent.vue`, `LeaveWorkspaceDialogContent.vue`, `RevokeInviteDialogContent.vue`; also the generic reusable `src/components/dialog/content/ConfirmationDialogContent.vue` (Cancel gets `autofocus`; delete action shows a trash icon).

## Error handling

Errors from the destructive action itself are surfaced via a toast (`useToast().add({ severity: 'error', ... })`) in the `catch` block — **not** as inline dialog text. See `patterns/notifications.md`.

## Do

- Put Cancel on the left, the destructive action on the right, every time — this is a hard convention in the codebase, don't flip it for visual variety.
- Drive the destructive button's `loading` state from the async delete/remove call.
- Autofocus Cancel (not the destructive action) when it matters that an accidental Enter-press doesn't trigger the destructive path.

## Don't

- Don't show inline error text in the dialog body for a failed destructive action — use a toast instead, matching existing behavior.
- Don't use `variant="primary"` for the destructive action — always `variant="destructive"`.
