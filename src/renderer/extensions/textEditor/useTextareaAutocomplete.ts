import { flip, offset, shift, useFloating } from '@floating-ui/vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, ref, shallowRef, watch } from 'vue'

import { useTextareaEdit } from '@/renderer/extensions/textEditor/useTextareaEdit'

function caretRectangle(element: HTMLTextAreaElement): DOMRect {
  const mirror = document.createElement('div')
  const style = getComputedStyle(element)
  for (const property of [
    'box-sizing',
    'width',
    'border-width',
    'border-style',
    'padding',
    'font',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'text-indent',
    'text-align',
    'direction',
    'tab-size',
    'word-break',
    'overflow-wrap',
    'scrollbar-gutter'
  ]) {
    mirror.style.setProperty(property, style.getPropertyValue(property))
  }
  Object.assign(mirror.style, {
    position: 'fixed',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    top: '0',
    left: '0'
  })
  mirror.textContent = element.value.slice(0, element.selectionStart)
  const marker = document.createElement('span')
  marker.textContent = element.value.slice(element.selectionStart) || '\u200b'
  mirror.append(marker)
  document.body.append(mirror)
  try {
    const origin = element.getBoundingClientRect()
    const caret =
      marker.getClientRects().item(0) ?? marker.getBoundingClientRect()
    const scaleX = element.offsetWidth ? origin.width / element.offsetWidth : 1
    const scaleY = element.offsetHeight
      ? origin.height / element.offsetHeight
      : 1
    return new DOMRect(
      origin.left + (caret.left - element.scrollLeft) * scaleX,
      origin.top + (caret.top - element.scrollTop) * scaleY,
      0,
      (caret.height || parseFloat(style.lineHeight)) * scaleY
    )
  } finally {
    mirror.remove()
  }
}

export function useTextareaAutocomplete({
  element,
  floating,
  enabled,
  suggest
}: {
  element: () => HTMLTextAreaElement | undefined
  floating: Readonly<Ref<HTMLElement | null>>
  enabled: () => boolean
  suggest: (query: string) => string[]
}) {
  const anchor = shallowRef<{ getBoundingClientRect: () => DOMRect }>()
  const query = shallowRef<{
    value: string
    from: number
    to: number
    matches: string[]
  }>()
  const active = ref(0)
  let composing = false
  const edit = useTextareaEdit(element, enabled)
  const matches = computed(() => query.value?.matches ?? [])
  const { floatingStyles, update } = useFloating(anchor, floating, {
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(6), flip(), shift({ padding: 12 })]
  })

  function close() {
    query.value = undefined
  }

  function sync() {
    const input = element()
    const current = edit.snapshot()
    if (
      !input ||
      !current ||
      document.activeElement !== input ||
      current.start !== current.end
    ) {
      close()
      return
    }
    const to = input.selectionStart
    const token = input.value.slice(0, to).match(/[^,;\n]+$/)?.[0] ?? ''
    const search = token.trimStart()
    const found = search.length < 2 ? [] : suggest(search)
    if (!found.length) {
      close()
      return
    }
    const rectangle = caretRectangle(input)
    anchor.value = { getBoundingClientRect: () => rectangle }
    query.value = {
      value: input.value,
      from: to - search.length,
      to,
      matches: found
    }
    active.value = 0
    update()
  }

  function accept(index: number) {
    const current = query.value
    const text = current?.matches[index]
    if (!current || !text) return
    edit.replace(
      { value: current.value, start: current.to, end: current.to },
      { from: current.from, to: current.to },
      text
    )
    close()
  }

  function navigate(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      close()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') close()
    else if (event.key === 'Enter') accept(active.value)
    else {
      active.value =
        (active.value +
          (event.key === 'ArrowDown' ? 1 : -1) +
          matches.value.length) %
        matches.value.length
    }
  }

  useEventListener(element, 'input', sync)
  useEventListener(element, 'click', sync)
  useEventListener(element, 'select', () => {
    const input = element()
    if (
      query.value &&
      (input?.selectionStart !== query.value.to ||
        input.selectionEnd !== query.value.to)
    )
      close()
  })
  useEventListener(element, 'keyup', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) sync()
  })
  useEventListener(element, 'scroll', close)
  useEventListener(element, 'blur', close)
  useEventListener(document, 'wheel', close, { capture: true, passive: true })
  useResizeObserver(element, close)
  useEventListener(window, 'resize', close)
  useEventListener(element, 'compositionstart', () => {
    composing = true
    close()
  })
  useEventListener(element, 'compositionend', () => {
    composing = false
    sync()
  })
  useEventListener(
    element,
    'keydown',
    (event) => {
      if (event.isComposing || event.keyCode === 229 || composing) return
      if (
        !query.value ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return
      navigate(event)
    },
    { capture: true }
  )
  watch(enabled, close)

  return { matches, active, floatingStyles, accept, close }
}
