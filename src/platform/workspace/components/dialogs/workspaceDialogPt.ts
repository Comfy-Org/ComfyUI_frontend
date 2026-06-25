/** Shared headless dialog passthrough styling for workspace dialogs. */
export const workspaceDialogPt = {
  headless: true,
  pt: {
    header: { class: 'p-0! hidden' },
    content: { class: 'p-0! m-0! rounded-2xl' },
    root: { class: 'rounded-2xl' }
  }
} as const
