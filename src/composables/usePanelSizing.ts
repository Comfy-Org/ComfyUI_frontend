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
  panelConfigs: readonly [SidePanelSizingConfig, SidePanelSizingConfig],
  containerWidth: MaybeRefOrGetter<number>,
  reservedWidth: MaybeRefOrGetter<number>
) {
  function storePanel(config: SidePanelSizingConfig) {
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
  }
  const storedPanels: readonly [
    ReturnType<typeof storePanel>,
    ReturnType<typeof storePanel>
  ] = [storePanel(panelConfigs[0]), storePanel(panelConfigs[1])]

  const panelPercentages = computed<readonly [number, number, number]>(() => {
    const total = toValue(containerWidth)
    if (total <= 0) return [20, 60, 20]
    const minimums: readonly [number, number] = [
      toValue(storedPanels[0].visible) ? toValue(storedPanels[0].minWidth) : 0,
      toValue(storedPanels[1].visible) ? toValue(storedPanels[1].minWidth) : 0
    ]
    const excesses: readonly [number, number] = [
      toValue(storedPanels[0].visible)
        ? Math.max(
            0,
            (storedPanels[0].width.value ?? storedPanels[0].defaultWidth()) -
              minimums[0]
          )
        : 0,
      toValue(storedPanels[1].visible)
        ? Math.max(
            0,
            (storedPanels[1].width.value ?? storedPanels[1].defaultWidth()) -
              minimums[1]
          )
        : 0
    ]
    const excess = excesses[0] + excesses[1]
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
    [() => toValue(containerWidth), layoutKey, panelRefs.first, panelRefs.last],
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
    if (gesture && !gesture.element.isConnected) gesture = undefined
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
    if (!handle) return
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
    panelRefs,
    onResizeStart,
    onResizeDragging,
    onResizeEnd
  }
}
