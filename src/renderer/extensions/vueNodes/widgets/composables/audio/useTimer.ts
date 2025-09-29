import { onUnmounted, ref } from 'vue'

export function useTimer() {
  const timer = ref(0)
  const timerInterval = ref<number | null>(null)

  function start(intervalMs: number = 1000) {
    timer.value = 0
    timerInterval.value = window.setInterval(() => {
      timer.value += 1
    }, intervalMs)
  }

  function stop() {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
  }

  function reset() {
    stop()
    timer.value = 0
  }

  function setTime(value: number) {
    timer.value = value
  }

  onUnmounted(() => {
    stop()
  })

  return {
    timer,
    start,
    stop,
    reset,
    setTime
  }
}
