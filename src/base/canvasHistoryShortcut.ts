export function preventNativeCanvasHistory(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const key = event.key.toUpperCase()
  if (key === 'Z' || (key === 'Y' && !event.shiftKey)) event.preventDefault()
}
