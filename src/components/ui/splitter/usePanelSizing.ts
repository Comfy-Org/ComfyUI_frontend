import { StorageSerializers, useStorage } from '@vueuse/core'
import { computed, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface SidePanel {
  id: string
  storageKey: MaybeRefOrGetter<string>
  visible: MaybeRefOrGetter<boolean>
  minWidth: MaybeRefOrGetter<number>
  defaultWidth: () => number
}

export function usePanelSizing(
  panels: [SidePanel, SidePanel],
  containerWidth: MaybeRefOrGetter<number>,
  reservedWidth: MaybeRefOrGetter<number>
) {
  const stored = panels.map((panel) => {
    const width = useStorage<number | null>(panel.storageKey, null, undefined, {
      serializer: StorageSerializers.number
    })
    watch(
      [width, () => toValue(panel.visible)],
      () => {
        if (!toValue(panel.visible)) return
        if (
          width.value === null ||
          !Number.isFinite(width.value) ||
          width.value <= 0
        ) {
          width.value = panel.defaultWidth()
          try {
            localStorage.setItem(toValue(panel.storageKey), String(width.value))
          } catch {
            return
          }
        }
      },
      { immediate: true }
    )
    return { ...panel, width }
  })

  const sizes = computed(() => {
    const total = toValue(containerWidth)
    if (total <= 0) return [20, 60, 20]
    const minimums = stored.map((panel) =>
      toValue(panel.visible) ? toValue(panel.minWidth) : 0
    )
    const excesses = stored.map((panel, i) =>
      toValue(panel.visible)
        ? Math.max(0, (panel.width.value ?? panel.defaultWidth()) - minimums[i])
        : 0
    )
    const excess = excesses.reduce((sum, width) => sum + width, 0)
    const available = Math.max(
      0,
      total - toValue(reservedWidth) - minimums[0] - minimums[1]
    )
    const scale = excess > 0 ? Math.min(1, available / excess) : 0
    const first = ((minimums[0] + excesses[0] * scale) / total) * 100
    const last = ((minimums[1] + excesses[1] * scale) / total) * 100
    return [first, 100 - first - last, last]
  })

  const layoutKey = computed(() =>
    [
      toValue(containerWidth),
      ...stored.map(
        (panel) => `${toValue(panel.storageKey)}:${toValue(panel.visible)}`
      )
    ].join(':')
  )
  let gesture:
    | {
        handle: Element
        panels: {
          index: number
          element: HTMLElement
          width: number
          key: string
        }[]
      }
    | undefined

  function onResizeStart(event: Event) {
    const handle =
      event.target instanceof Element
        ? event.target.closest(
            '[data-panel-resize-handle-id][data-orientation="horizontal"]'
          )
        : null
    if (!handle || gesture?.handle === handle) return
    const adjacent = [handle.previousElementSibling, handle.nextElementSibling]
    gesture = {
      handle,
      panels: stored.flatMap((panel, index) => {
        if (!toValue(panel.visible)) return []
        const element = adjacent.find(
          (el) => el?.getAttribute('data-panel-id') === panel.id
        )
        return element instanceof HTMLElement
          ? [
              {
                index,
                element,
                width: element.getBoundingClientRect().width,
                key: toValue(panel.storageKey)
              }
            ]
          : []
      })
    }
  }

  function onResizeEnd() {
    for (const start of gesture?.panels ?? []) {
      const panel = stored[start.index]
      const width = start.element.getBoundingClientRect().width
      if (
        start.element.isConnected &&
        width > 0 &&
        width !== start.width &&
        toValue(panel.storageKey) === start.key
      ) {
        panel.width.value = width
      }
    }
    gesture = undefined
  }

  return { sizes, layoutKey, onResizeStart, onResizeEnd }
}
