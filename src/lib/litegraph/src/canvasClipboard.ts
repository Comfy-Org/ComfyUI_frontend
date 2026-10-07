export const CANVAS_CLIPBOARD_KEY = 'litegrapheditor_clipboard'
export const CANVAS_CLIPBOARD_ID_KEY = 'litegrapheditor_clipboard_id'

export function snapshotCanvasClipboard(): () => void {
  const entries = [CANVAS_CLIPBOARD_KEY, CANVAS_CLIPBOARD_ID_KEY].map(
    (key) => [key, localStorage.getItem(key)] as const
  )
  return () => {
    for (const [key, value] of entries) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
  }
}
