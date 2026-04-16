import { ref } from 'vue'

const message = ref('')
const shortcut = ref('')
const hint = ref('')
const visible = ref(false)
const actionLabel = ref('')
const onAction = ref<(() => void) | null>(null)
let timeout: ReturnType<typeof setTimeout> | null = null
let duration = 2000

export function useSnackbarToast() {
  function show(
    msg: string,
    options?: {
      shortcut?: string
      hint?: string
      duration?: number
      actionLabel?: string
      onAction?: () => void
    }
  ) {
    if (timeout) clearTimeout(timeout)
    message.value = msg
    shortcut.value = options?.shortcut ?? ''
    hint.value = options?.hint ?? ''
    actionLabel.value = options?.actionLabel ?? ''
    onAction.value = options?.onAction ?? null
    duration = options?.duration ?? 2000
    visible.value = true
    startTimer()
  }

  function startTimer() {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      visible.value = false
    }, duration)
  }

  function pause() {
    if (timeout) clearTimeout(timeout)
  }

  function dismiss() {
    if (timeout) clearTimeout(timeout)
    visible.value = false
  }

  return {
    message,
    shortcut,
    hint,
    visible,
    actionLabel,
    onAction,
    show,
    dismiss,
    pause,
    startTimer
  }
}
