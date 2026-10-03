import { StorageSerializers, useStorage } from '@vueuse/core'
import type { SplitterPanel } from 'reka-ui'
import { computed, nextTick, shallowRef, toValue, watch } from 'vue'
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
    stored
      .map((panel) => `${toValue(panel.storageKey)}:${toValue(panel.visible)}`)
      .join(':')
  )
  const panelRefs = {
    first: shallowRef<InstanceType<typeof SplitterPanel>>(),
    last: shallowRef<InstanceType<typeof SplitterPanel>>()
  }
  watch(
    () => toValue(containerWidth),
    async () => {
      await nextTick()
      const updates = [panelRefs.first.value, panelRefs.last.value].flatMap(
        (panel, index) => {
          if (!panel || !toValue(stored[index].visible)) return []
          const size = sizes.value[index * 2]
          return [{ panel, size, delta: size - panel.getSize() }]
        }
      )
      for (const { panel, size } of updates.sort((a, b) => a.delta - b.delta)) {
        panel.resize(size)
      }
    },
    { flush: 'post' }
  )
  let gesture:
    | {
        index: number
        element: HTMLElement
        width: number
        key: string
      }
    | undefined

  function capturePanel(panelId: string) {
    if (gesture) return
    const element = document.querySelector(`[data-panel-id="${panelId}"]`)
    if (!(element instanceof HTMLElement)) return
    const index = stored.findIndex((panel) => panel.id === panelId)
    if (index < 0) return
    const panel = stored[index]
    if (!toValue(panel.visible)) return
    gesture = {
      index,
      element,
      width: element.getBoundingClientRect().width,
      key: toValue(panel.storageKey)
    }
  }

  function onResizeStart(event: Event) {
    const handle =
      event.target instanceof Element
        ? event.target.closest(
            '[data-panel-resize-handle-id][data-orientation="horizontal"]'
          )
        : null
    if (!handle || gesture) return
    const adjacent = [handle.previousElementSibling, handle.nextElementSibling]
    const panel = stored.find(({ id }) =>
      adjacent.some((element) => element?.getAttribute('data-panel-id') === id)
    )
    if (panel) capturePanel(panel.id)
  }

  function onResizeDragging(dragging: boolean, panelId: string) {
    if (dragging) capturePanel(panelId)
    else onResizeEnd()
  }

  function onResizeEnd() {
    if (!gesture) return
    const panel = stored[gesture.index]
    const width = gesture.element.getBoundingClientRect().width
    if (
      gesture.element.isConnected &&
      width > 0 &&
      width !== gesture.width &&
      toValue(panel.storageKey) === gesture.key
    ) {
      panel.width.value = width
    }
    gesture = undefined
  }

  return {
    sizes,
    layoutKey,
    panelRefs,
    onResizeStart,
    onResizeDragging,
    onResizeEnd
  }
}
