import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { ShallowRef } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import type { MinimapCanvas, MinimapSettingsKey } from '../types'
import { useMinimapGraph } from './useMinimapGraph'
import { useMinimapInteraction } from './useMinimapInteraction'
import { useMinimapRenderer } from './useMinimapRenderer'
import { useMinimapSettings } from './useMinimapSettings'
import { useMinimapViewport } from './useMinimapViewport'

/** How often to compare digests for state that emits no event; see the poll. */
const CHANGE_DETECTION_INTERVAL_MS = 100

export function useMinimap({
  canvasRefMaybe,
  containerRefMaybe
}: {
  canvasRefMaybe?: Readonly<ShallowRef<HTMLCanvasElement | null>>
  containerRefMaybe?: Readonly<ShallowRef<HTMLDivElement | null>>
} = {}) {
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()

  const canvasRef = canvasRefMaybe ?? shallowRef(null)
  const containerRef = containerRefMaybe ?? shallowRef(null)

  const visible = ref(true)
  const initialized = ref(false)

  const width = 250
  const height = 200

  const canvas = computed(() => canvasStore.canvas as MinimapCanvas | null)
  const graph = computed(() => {
    // If we're in a subgraph, use that; otherwise use the canvas graph
    const activeSubgraph = workflowStore.activeSubgraph
    return (activeSubgraph || canvas.value?.graph) as LGraph | null
  })

  // Settings
  const settings = useMinimapSettings()
  const {
    nodeColors,
    showLinks,
    showGroups,
    renderBypass,
    renderError,
    containerStyles,
    panelStyles
  } = settings

  // Viewport management
  const viewport = useMinimapViewport(canvas, graph, width, height)

  // Interaction handling
  const interaction = useMinimapInteraction(
    containerRef,
    viewport.bounds,
    viewport.scale,
    width,
    height,
    viewport.centerViewOn,
    canvas
  )

  // Two of the three useMinimap() call sites have no canvas. updateBounds()
  // runs before renderMinimap discovers there is nothing to draw, and it costs
  // a full layout-map rebuild, so every path that redraws checks this first.
  const canDraw = computed(() => visible.value && !!canvasRef.value)

  const changeDetector = useMinimapGraph(graph)

  // Rendering
  const renderer = useMinimapRenderer(
    canvasRef,
    graph,
    viewport.bounds,
    viewport.scale,
    changeDetector.updateFlags,
    settings,
    width,
    height
  )

  const checkAndRepaint = () => {
    if (!canDraw.value) return
    if (changeDetector.checkForChanges()) {
      renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
    }
  }

  const updateOption = async (key: MinimapSettingsKey, value: boolean) => {
    await settingStore.set(key, value)
    if (!canDraw.value) return
    renderer.forceFullRedraw()
    renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
  }

  // Some rendered state is mutated directly and emits no reliable event. A
  // single digest poll covers every source while avoiding work on idle ticks.
  const { pause: pauseChangeDetection, resume: resumeChangeDetection } =
    useIntervalFn(checkAndRepaint, CHANGE_DETECTION_INTERVAL_MS, {
      immediate: false
    })

  // Derive polling from current lifecycle state because init can run before the
  // template canvas mounts. Hidden documents pause the O(n) digest scan.
  const documentVisibility = useDocumentVisibility()
  const shouldPoll = computed(
    () =>
      initialized.value &&
      canDraw.value &&
      documentVisibility.value !== 'hidden'
  )

  watch(
    shouldPoll,
    (active) => {
      if (active) resumeChangeDetection()
      else pauseChangeDetection()
    },
    { immediate: true }
  )

  const init = async () => {
    if (initialized.value) return

    visible.value = settingStore.get('Comfy.Minimap.Visible')

    if (canvas.value && graph.value) {
      if (containerRef.value) {
        interaction.updateContainerRect()
      }
      viewport.updateCanvasDimensions()

      window.addEventListener('resize', interaction.updateContainerRect)
      window.addEventListener('scroll', interaction.updateContainerRect)
      window.addEventListener('resize', viewport.updateCanvasDimensions)

      if (canDraw.value) changeDetector.checkForChanges()
      renderer.forceFullRedraw()
      renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
      viewport.updateViewport()

      if (visible.value) viewport.startViewportSync()
      initialized.value = true
    }
  }

  const destroy = () => {
    pauseChangeDetection()
    viewport.stopViewportSync()
    changeDetector.reset()

    window.removeEventListener('resize', interaction.updateContainerRect)
    window.removeEventListener('scroll', interaction.updateContainerRect)
    window.removeEventListener('resize', viewport.updateCanvasDimensions)

    initialized.value = false
  }

  watch(
    canvas,
    async (newCanvas, oldCanvas) => {
      if (oldCanvas) {
        destroy()
      }
      if (newCanvas && !initialized.value) {
        await init()
      }
    },
    { immediate: true, flush: 'post' }
  )

  // Watch for graph changes (e.g., when navigating to/from subgraphs)
  watch(graph, (newGraph, oldGraph) => {
    if (!newGraph || newGraph === oldGraph) return
    changeDetector.reset()
    if (!canDraw.value) return
    changeDetector.checkForChanges()
    renderer.forceFullRedraw()
    renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
  })

  watch(visible, async (isVisible) => {
    if (isVisible) {
      if (containerRef.value) {
        interaction.updateContainerRect()
      }
      viewport.updateCanvasDimensions()

      changeDetector.checkForChanges()
      renderer.forceFullRedraw()

      await nextTick()
      await nextTick()

      renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
      viewport.updateViewport()
      viewport.startViewportSync()
    } else {
      viewport.stopViewportSync()
    }
  })

  const toggle = async () => {
    visible.value = !visible.value
    await settingStore.set('Comfy.Minimap.Visible', visible.value)
  }

  // Dynamic viewport styles based on actual viewport transform
  const viewportStyles = computed(() => {
    const transform = viewport.viewportTransform.value
    return {
      transform: `translate(${transform.x}px, ${transform.y}px)`,
      width: `${transform.width}px`,
      height: `${transform.height}px`,
      border: `2px solid ${settings.isLightTheme.value ? '#E0E0E0' : '#FFF'}`,
      backgroundColor: `rgba(255, 255, 255, 0.2)`,
      willChange: 'transform',
      backfaceVisibility: 'hidden' as const,
      perspective: '1000px',
      pointerEvents: 'none' as const
    }
  })

  return {
    visible: computed(() => visible.value),
    initialized: computed(() => initialized.value),

    containerStyles,
    viewportStyles,
    panelStyles,
    width,
    height,

    nodeColors,
    showLinks,
    showGroups,
    renderBypass,
    renderError,

    init,
    destroy,
    toggle,
    renderMinimap: renderer.renderMinimap,
    handlePointerDown: interaction.handlePointerDown,
    handlePointerMove: interaction.handlePointerMove,
    handlePointerUp: interaction.handlePointerUp,
    handlePointerCancel: interaction.handlePointerCancel,
    handleWheel: interaction.handleWheel,
    updateOption
  }
}
