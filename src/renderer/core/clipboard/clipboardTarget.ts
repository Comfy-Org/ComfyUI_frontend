import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

export function shouldIgnoreCopyPaste(target: EventTarget | null): boolean {
  const isTextInput =
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable) ||
    (target instanceof HTMLInputElement &&
      ![
        'button',
        'checkbox',
        'file',
        'hidden',
        'image',
        'radio',
        'range',
        'reset',
        'submit'
      ].includes(target.type))
  const selection = window.getSelection()
  return (
    isTextInput ||
    useCanvasStore().linearMode ||
    (selection !== null && !selection.isCollapsed)
  )
}
