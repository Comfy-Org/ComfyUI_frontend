import { StorageSerializers, useStorage } from '@vueuse/core'
import type { SplitterPanel } from 'reka-ui'
import { computed, nextTick, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface SidePanelSizingConfig {
  id: string
  storageKey: MaybeRefOrGetter<string>
  visible: MaybeRefOrGetter<boolean>
  minWidth: MaybeRefOrGetter<number>
  defaultWidth: () => number
}

export function usePanelSizing(
  panelConfigs: [SidePanelSizingConfig, SidePanelSizingConfig],
  containerWidth: MaybeRefOrGetter<number>,
  reservedWidth: MaybeRefOrGetter<number>
) {
  const storedPanels = panelConfigs.map((config) => {
    const width = useStorage<number | null>(
      config.storageKey,
      null,
      undefined,
      {
        serializer: StorageSerializers.number
      }
    )
    watch(
      [width, () => toValue(config.visible)],
      () => {
        if (!toValue(config.visible)) return
        if (
          width.value === null ||
          !Number.isFinite(width.value) ||
          width.value <= 0
        ) {
          width.value = config.defaultWidth()
        }
      },
      { immediate: true }
    )
    return { ...config, width }
  })

  const panelPercentages = computed(() => {
    const total = toValue(containerWidth)
    if (total <= 0) return [20, 60, 20]
    const minimums = storedPanels.map((panel) =>
      toValue(panel.visible) ? toValue(panel.minWidth) : 0
    )
    const excesses = storedPanels.map((panel, i) =>
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
    storedPanels
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
        (splitterPanel, index) => {
          if (!splitterPanel || !toValue(storedPanels[index].visible)) return []
          const size = panelPercentages.value[index * 2]
          return [
            { splitterPanel, size, delta: size - splitterPanel.getSize() }
          ]
        }
      )
      for (const { splitterPanel, size } of updates.sort(
        (a, b) => a.delta - b.delta
      )) {
        splitterPanel.resize(size)
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
    const index = storedPanels.findIndex((panel) => panel.id === panelId)
    if (index < 0) return
    const panel = storedPanels[index]
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
    const panel = storedPanels.find(({ id }) =>
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
    const panel = storedPanels[gesture.index]
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
    panelPercentages,
    layoutKey,
    panelRefs,
    onResizeStart,
    onResizeDragging,
    onResizeEnd
  }
}
