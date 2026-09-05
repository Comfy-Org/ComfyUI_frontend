import type { Ref } from 'vue'

// A roving tabindex leaves every tab but the active one out of the tab order,
// so the tablist has to move between them itself.
export function useTablist<T>(items: () => readonly T[], active: Ref<T>) {
  function onKeydown(event: KeyboardEvent) {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()

    const values = items()
    const next =
      (values.indexOf(active.value) + step + values.length) % values.length
    active.value = values[next]

    const tabs = (
      event.currentTarget as HTMLElement
    ).querySelectorAll<HTMLElement>('[role="tab"]')
    tabs[next]?.focus()
  }

  return { onKeydown }
}
