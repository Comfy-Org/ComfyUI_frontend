import { useEventListener } from '@vueuse/core'
import type { Ref, ShallowRef } from 'vue'
import { ref } from 'vue'

interface UsePaletteSwatchRowOptions {
  modelValue: Ref<string[]>
  container: Readonly<ShallowRef<HTMLDivElement | null>>
  picker: Readonly<ShallowRef<HTMLInputElement | null>>
}

export function usePaletteSwatchRow({
  modelValue,
  container,
  picker
}: UsePaletteSwatchRowOptions) {
  const pickerIndex = ref<number | null>(null)

  function openPicker(i: number, e: MouseEvent) {
    e.stopPropagation()
    pickerIndex.value = i
    const el = picker.value
    if (!el) return
    el.value = modelValue.value[i] || '#ffffff'
    el.click()
  }

  function onPickerInput(e: Event) {
    const v = (e.target as HTMLInputElement).value
    if (pickerIndex.value === null) return
    const next = modelValue.value.slice()
    next[pickerIndex.value] = v
    modelValue.value = next
  }

  function remove(i: number) {
    const next = modelValue.value.slice()
    next.splice(i, 1)
    modelValue.value = next
  }

  function addColor() {
    modelValue.value = [...modelValue.value, '#ffffff']
  }

  const drag = ref<{
    index: number
    startX: number
    startY: number
    active: boolean
  } | null>(null)

  function onPointerDown(i: number, e: PointerEvent) {
    if (e.button !== 0) return
    drag.value = {
      index: i,
      startX: e.clientX,
      startY: e.clientY,
      active: false
    }
  }

  useEventListener(document, 'pointermove', (e: PointerEvent) => {
    const d = drag.value
    if (!d) return
    if ((e.buttons & 1) === 0) {
      drag.value = null
      return
    }
    if (!d.active) {
      if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 4)
        return
      d.active = true
    }
    const rows =
      container.value?.querySelectorAll<HTMLDivElement>('[data-index]')
    if (!rows) return
    for (const other of rows) {
      if (parseInt(other.dataset.index || '-1', 10) === d.index) continue
      const r = other.getBoundingClientRect()
      if (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top - 6 &&
        e.clientY <= r.bottom + 6
      ) {
        const oi = parseInt(other.dataset.index || '-1', 10)
        if (oi < 0) continue
        const next = modelValue.value.slice()
        const [moved] = next.splice(d.index, 1)
        const insertAt = e.clientX > r.left + r.width / 2 ? oi + 1 : oi
        next.splice(insertAt > d.index ? insertAt - 1 : insertAt, 0, moved)
        modelValue.value = next
        drag.value = null
        return
      }
    }
  })

  useEventListener(document, 'pointerup', () => {
    drag.value = null
  })

  useEventListener(document, 'pointercancel', () => {
    drag.value = null
  })

  return {
    openPicker,
    onPickerInput,
    remove,
    addColor,
    onPointerDown
  }
}
