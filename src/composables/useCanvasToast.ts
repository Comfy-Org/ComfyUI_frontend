import { ref } from 'vue'

const message = ref('')
const shortcut = ref('')
const visible = ref(false)
let timeout: ReturnType<typeof setTimeout> | null = null

export function useCanvasToast() {
  function show(
    msg: string,
    options?: { shortcut?: string; duration?: number }
  ) {
    if (timeout) clearTimeout(timeout)
    message.value = msg
    shortcut.value = options?.shortcut ?? ''
    visible.value = true
    timeout = setTimeout(() => {
      visible.value = false
    }, options?.duration ?? 2000)
  }

  return { message, shortcut, visible, show }
}
