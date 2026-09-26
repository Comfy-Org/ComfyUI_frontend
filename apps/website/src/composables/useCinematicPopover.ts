import { nextTick, ref, watch } from 'vue'

/**
 * Which Cinematic Studio popover is open. Closing one returns focus to the
 * control that opened it when focus was inside the popover or got lost.
 */
export function useCinematicPopover<Key extends string>() {
  const open = ref<Key>()
  let opener: HTMLElement | undefined

  function toggle(key: Key) {
    const active = document.activeElement
    if (active instanceof HTMLElement) opener = active
    open.value = open.value === key ? undefined : key
  }

  function close() {
    open.value = undefined
  }

  watch(open, async (isOpen, wasOpen) => {
    if (isOpen || !wasOpen) return
    const focusWasInPopover = !!document.activeElement?.closest(
      '[data-testid="cinematic-picker"]'
    )
    await nextTick()
    if (focusWasInPopover || document.activeElement === document.body)
      opener?.focus()
  })

  return { open, toggle, close }
}
