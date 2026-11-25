import {
  useDocumentVisibility,
  useEventListener,
  useIntervalFn,
  usePreferredReducedMotion,
  useRafFn
} from '@vueuse/core'
import { computed, watch } from 'vue'
import type { CSSProperties, ShallowRef } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import {
  getMinimapDecorations,
  minimapDecorationRevision
} from '@/platform/canvas/minimapDecorationRegistry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'

import { useThemeStore } from '@/platform/theme/themeStore'
import { useExecutionStore } from '@/stores/executionStore'
import { MinimapDataSource } from '@/renderer/extensions/minimap/data/MinimapDataSource'
import {
  MINIMAP_DECORATION_POP_MS,
  renderMinimapToCanvas
} from '@/renderer/extensions/minimap/minimapCanvasRenderer'
import type {
  MinimapCanvas,
  MinimapChange,
  MinimapSettingsKey
} from '@/renderer/extensions/minimap/types'
import { useMinimapGraph } from './useMinimapGraph'
import { useMinimapInteraction } from './useMinimapInteraction'
import { useMinimapSettings } from './useMinimapSettings'
import { useMinimapViewport } from './useMinimapViewport'

const CHANGE_DETECTION_INTERVAL_MS = 100

export function useMinimap({
  canvasRef,
  containerRef
}: {
  canvasRef: Readonly<ShallowRef<HTMLCanvasElement | null>>
  containerRef: Readonly<ShallowRef<HTMLDivElement | null>>
}) {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const executionStore = useExecutionStore()
  const themeStore = useThemeStore()
  const motionPreference = usePreferredReducedMotion()
  const documentVisibility = useDocumentVisibility()
  const width = 250
  const height = 200
  const graph = computed(() => canvasStore.currentGraph)
  const canvas = computed<MinimapCanvas | null>(() =>
    graph.value ? canvasStore.canvas : null
  )
  const active = computed(
    () =>
      !!canvas.value &&
      !!canvasRef.value &&
      documentVisibility.value !== 'hidden'
  )
  const decorations = computed(() => {
    const revision = minimapDecorationRevision.value
    void revision
    if (!graph.value) return []
    const rows = getMinimapDecorations(graphScopeOf(graph.value))
    const reducedMotion =
      settingStore.get('Comfy.Appearance.DisableAnimations') ||
      motionPreference.value === 'reduce'
    return reducedMotion
      ? rows.map((row) => ({
          ...row,
          enter: undefined,
          enteredAt: undefined
        }))
      : rows
  })

  const {
    nodeColors,
    showLinks,
    showGroups,
    renderBypass,
    renderError,
    containerStyles,
    panelStyles
  } = useMinimapSettings()

  const updateOption = (key: MinimapSettingsKey, value: boolean) =>
    settingStore.set(key, value)

  const viewport = useMinimapViewport(canvas, width, height)

  const interaction = useMinimapInteraction(
    containerRef,
    viewport.bounds,
    viewport.scale,
    width,
    height,
    viewport.centerViewOn,
    canvas
  )

  const graphReader = useMinimapGraph(graph)
  let publishedSource: MinimapDataSource | undefined

  function paint(source: MinimapDataSource, now: number) {
    if (!active.value || !canvasRef.value) return
    renderMinimapToCanvas(canvasRef.value, source, {
      bounds: viewport.bounds.value,
      scale: viewport.scale.value,
      settings: {
        nodeColors: nodeColors.value,
        showLinks: showLinks.value,
        showGroups: showGroups.value,
        renderBypass: renderBypass.value,
        renderError: renderError.value
      },
      width,
      height,
      decorations: decorations.value,
      now
    })
  }

  function refresh(minimum: MinimapChange = 'none', now = performance.now()) {
    if (!active.value) return
    const change = graphReader.checkForChanges()
    if (change === 'none' && minimum === 'none') return
    const source = new MinimapDataSource(
      graph.value,
      executionStore.nodeLocationProgressStates
    )
    if (change === 'geometry' || minimum === 'geometry') {
      viewport.updateBounds(source)
      viewport.updateViewport()
    }
    publishedSource = source
    paint(source, now)
  }

  function hasAnimatingDecorations(now: number) {
    return decorations.value.some(
      ({ enteredAt }) =>
        enteredAt !== undefined && now - enteredAt < MINIMAP_DECORATION_POP_MS
    )
  }

  const decorationFrames = useRafFn(
    () => {
      const now = performance.now()
      if (publishedSource) paint(publishedSource, now)
      if (!active.value || !hasAnimatingDecorations(now))
        decorationFrames.pause()
    },
    { immediate: false }
  )

  const changeDetection = useIntervalFn(refresh, CHANGE_DETECTION_INTERVAL_MS, {
    immediate: false
  })

  useEventListener(window, 'resize', interaction.updateContainerRect)
  useEventListener(window, 'scroll', interaction.updateContainerRect)
  useEventListener(window, 'resize', viewport.updateCanvasDimensions)

  watch(
    [active, canvas, canvasRef, containerRef, graph],
    ([isActive]) => {
      changeDetection.pause()
      viewport.stopViewportSync()
      decorationFrames.pause()
      if (!graph.value) {
        publishedSource = undefined
        canvasRef.value?.getContext('2d')?.clearRect(0, 0, width, height)
      }
      if (!isActive) return
      interaction.updateContainerRect()
      viewport.updateCanvasDimensions()
      const now = performance.now()
      refresh('geometry', now)
      changeDetection.resume()
      viewport.startViewportSync()
      if (hasAnimatingDecorations(now)) decorationFrames.resume()
    },
    { immediate: true, flush: 'post' }
  )

  watch(
    [
      nodeColors,
      showLinks,
      showGroups,
      renderBypass,
      renderError,
      () => themeStore.activeTheme,
      decorations
    ],
    () => {
      const now = performance.now()
      refresh('picture', now)
      if (active.value && hasAnimatingDecorations(now))
        decorationFrames.resume()
      else decorationFrames.pause()
    },
    { flush: 'post' }
  )

  const viewportStyles = {
    width: `${width}px`,
    height: `${height}px`,
    transformOrigin: '0 0',
    backgroundColor: 'color-mix(in srgb, var(--foreground) 20%, transparent)',
    willChange: 'transform',
    pointerEvents: 'none'
  } satisfies CSSProperties

  const viewportTransforms = computed(() => {
    const transform = viewport.viewportTransform.value
    const scaleX = transform.width / width
    const scaleY = transform.height / height
    return {
      box: `translate(${transform.x}px, ${transform.y}px) scale(${scaleX}, ${scaleY})`,
      horizontalEdge: `scaleY(${1 / (scaleY || 1)})`,
      verticalEdge: `scaleX(${1 / (scaleX || 1)})`
    }
  })

  return {
    interactive: computed(() => !!canvas.value),
    decorationCount: computed(() => decorations.value.length),

    containerStyles,
    viewportStyles,
    viewportTransforms,
    panelStyles,
    width,
    height,

    nodeColors,
    showLinks,
    showGroups,
    renderBypass,
    renderError,

    handlePointerDown: interaction.handlePointerDown,
    handlePointerMove: interaction.handlePointerMove,
    handlePointerUp: interaction.handlePointerUp,
    handlePointerCancel: interaction.handlePointerCancel,
    handleWheel: interaction.handleWheel,
    updateOption
  }
}
