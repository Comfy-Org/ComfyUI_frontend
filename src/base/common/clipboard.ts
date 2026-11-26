export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.setAttribute('readonly', '')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      try {
        textarea.select()
        return document.execCommand('copy')
      } finally {
        textarea.remove()
      }
    } catch {
      return false
    }
  }
}
