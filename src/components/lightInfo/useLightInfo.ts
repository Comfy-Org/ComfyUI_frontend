import { computed, ref, toRaw, unref } from 'vue'
import type { MaybeRef } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import {
  getNodeWidgetValue,
  setNodeWidgetValue
} from '@/core/graph/widgets/nodeWidgetValues'
import { LightInfoViewport } from '@/extensions/core/lightInfo/LightInfoViewport'
import type { LightTransformGizmoMode } from '@/extensions/core/lightInfo/LightInfoViewport'
import { normalizeLightsValue } from '@/extensions/core/lightInfo/lightsValue'
import {
  cloneLights,
  createDefaultLight
} from '@/extensions/core/lightInfo/types'
import type {
  LightInfoEntry,
  LightInfoType
} from '@/extensions/core/lightInfo/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

const EDITOR_WIDGET_NAME = 'editor_state'

export function useLightInfo(nodeRef: MaybeRef<LGraphNode | null>) {
  let viewport: LightInfoViewport | null = null
  let host: LGraphNode | null = null
  let stopObserving: (() => void) | null = null
  let suppressEcho = false

  const lights = ref<LightInfoEntry[]>([])
  const selectedIndex = ref(-1)

  const selectedLight = computed<LightInfoEntry | null>(
    () => lights.value[selectedIndex.value] ?? null
  )

  const initialize = (container: HTMLElement): void => {
    const raw = toRaw(unref(nodeRef))
    if (!raw) return

    try {
      host = raw
      lights.value = normalizeLightsValue(
        getNodeWidgetValue(raw, EDITOR_WIDGET_NAME)
      )
      selectedIndex.value = lights.value.length ? 0 : -1
      viewport = new LightInfoViewport(container, lights.value, {
        onLightsChange: (next) => {
          lights.value = next
          writeWidgetValue(next)
        },
        onSelectLight: (index) => {
          selectedIndex.value = index
        }
      })
      viewport.applyLights(lights.value, selectedIndex.value)
      observeExternalChanges(raw)
      wireNodeMouseStatus(raw)
    } catch (error) {
      console.error('Failed to initialize LightInfoViewport:', error)
      useToastStore().addAlert('Failed to initialize Light Info viewport.')
    }
  }

  const cleanup = (): void => {
    stopObserving?.()
    stopObserving = null
    host = null
    viewport?.remove()
    viewport = null
  }

  const handleMouseEnter = (): void => {
    viewport?.viewport.updateStatusMouseOnScene(true)
    viewport?.viewport.refreshViewport()
  }

  const handleMouseLeave = (): void => {
    viewport?.viewport.updateStatusMouseOnScene(false)
  }

  const setGizmosVisible = (on: boolean): void => {
    viewport?.setGizmosVisible(on)
  }

  const setTransformGizmoMode = (mode: LightTransformGizmoMode): void => {
    viewport?.setTransformGizmoMode(mode)
  }

  const resetViewToOutput = (): void => {
    viewport?.resetViewToOutput()
  }

  const setCameraLocked = (locked: boolean): void => {
    viewport?.setCameraLocked(locked)
  }

  const selectLight = (index: number): void => {
    if (index < 0 || index >= lights.value.length) return
    selectedIndex.value = index
    viewport?.applyLights(lights.value, index)
  }

  const addLight = (type: LightInfoType): void => {
    const next = [...lights.value, createDefaultLight(type)]
    selectedIndex.value = next.length - 1
    commit(next)
  }

  const removeSelectedLight = (): void => {
    if (selectedIndex.value < 0) return
    const next = [...lights.value]
    next.splice(selectedIndex.value, 1)
    selectedIndex.value = Math.min(selectedIndex.value, next.length - 1)
    commit(next)
  }

  const updateSelectedLight = (patch: Partial<LightInfoEntry>): void => {
    const current = selectedLight.value
    if (!current) return
    const next = [...lights.value]
    next[selectedIndex.value] = normalizeLightsValue([
      { ...current, ...patch }
    ])[0]
    commit(next)
  }

  const setSelectedLightType = (type: LightInfoType): void => {
    const current = selectedLight.value
    if (!current || current.type === type) return
    const base = createDefaultLight(type)
    const next = [...lights.value]
    next[selectedIndex.value] = {
      ...base,
      color: current.color,
      position: { ...current.position },
      ...(base.target && current.target
        ? { target: { ...current.target } }
        : {})
    }
    commit(next)
  }

  function commit(next: LightInfoEntry[]): void {
    lights.value = next
    if (selectedIndex.value >= next.length) {
      selectedIndex.value = next.length - 1
    }
    writeWidgetValue(next)
    viewport?.applyLights(next, selectedIndex.value)
  }

  function writeWidgetValue(next: LightInfoEntry[]): void {
    if (!host) return
    suppressEcho = true
    try {
      setNodeWidgetValue(host, EDITOR_WIDGET_NAME, cloneLights(next))
    } finally {
      suppressEcho = false
    }
  }

  function applyExternalValue(value: unknown): void {
    if (suppressEcho || !viewport) return
    lights.value = normalizeLightsValue(value)
    if (selectedIndex.value >= lights.value.length) {
      selectedIndex.value = lights.value.length - 1
    } else if (selectedIndex.value < 0 && lights.value.length) {
      selectedIndex.value = 0
    }
    viewport.applyLights(lights.value, selectedIndex.value)
  }

  function observeExternalChanges(target: LGraphNode): void {
    const graphId = target.graph?.rootGraph.id
    if (!graphId) return
    const editorWidgetId = widgetId(graphId, target.id, EDITOR_WIDGET_NAME)
    stopObserving = useWidgetValueStore().onValueChange((change) => {
      if (change.widgetId === editorWidgetId) applyExternalValue(change.value)
    })
  }

  function wireNodeMouseStatus(target: LGraphNode): void {
    target.onMouseEnter = useChainCallback(target.onMouseEnter, () => {
      viewport?.viewport.updateStatusMouseOnNode(true)
      viewport?.viewport.refreshViewport()
    })
    target.onMouseLeave = useChainCallback(target.onMouseLeave, () => {
      viewport?.viewport.updateStatusMouseOnNode(false)
    })
  }

  return {
    initialize,
    cleanup,
    handleMouseEnter,
    handleMouseLeave,
    setGizmosVisible,
    setTransformGizmoMode,
    resetViewToOutput,
    setCameraLocked,
    lights,
    selectedIndex,
    selectedLight,
    selectLight,
    addLight,
    removeSelectedLight,
    updateSelectedLight,
    setSelectedLightType
  }
}
