export const editorStatusCommandIds = {
  submit: 'comfy.submitCustomNode',
  validate: 'comfy.validateCustomNode'
} as const

export type EditorStatusCommandId =
  (typeof editorStatusCommandIds)[keyof typeof editorStatusCommandIds]

const editorStatusCommandLabels: Record<EditorStatusCommandId, string> = {
  [editorStatusCommandIds.submit]: 'Submit Node',
  [editorStatusCommandIds.validate]: 'Validate Node'
}

export const invokeEditorStatusCommand = (
  editorFrame: HTMLIFrameElement | null,
  commandId: EditorStatusCommandId
): boolean => {
  const statusItem = Array.from(
    editorFrame?.contentDocument?.querySelectorAll<HTMLElement>(
      '.statusbar-item'
    ) ?? []
  ).find(
    (item) =>
      item.id.endsWith(commandId) ||
      item.textContent?.includes(editorStatusCommandLabels[commandId])
  )
  const control = statusItem?.querySelector<HTMLElement>('[role="button"]')
  if (!control) return false
  control.click()
  return true
}
