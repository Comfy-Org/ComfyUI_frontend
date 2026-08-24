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

  const minimapRef = ref<HTMLElement | null>(null)
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

  const updateOption = async (key: MinimapSettingsKey, value: boolean) => {
    await settingStore.set(key, value)
    renderer.forceFullRedraw()
    renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
  }

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

  // Graph events are hints to compare the digests, not commands to repaint:
  // graphChanged fires for plenty the minimap does not draw (zIndex from every
  // widget pointerdown, widget values, title edits), and the digest is the one
  // place that knows whether the picture moved.
  const checkAndRepaint = () => {
    if (!canDraw.value) return
    if (graphManager.checkForChanges()) {
      renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
    }
  }

  const graphManager = useMinimapGraph(graph, () => checkAndRepaint())

  // Rendering
  const renderer = useMinimapRenderer(
    canvasRef,
    graph,
    viewport.bounds,
    viewport.scale,
    graphManager.updateFlags,
    settings,
    width,
    height
  )

  // Most edits reach the digest comparison through useMinimapGraph's event
  // hooks. This loop is the backstop for state that emits no event at all:
  // snapPoint mutating `_pos` elements in place, extensions assigning
  // `node.pos[0]` directly (only `size` is Proxy-wrapped against that),
  // `has_errors`, group drags, and execution-state transitions, which arrive
  // in executionStore rather than as graph events. Repaints happen only when
  // the digests move, so idle ticks cost one O(n) comparison and nothing else.
  const { pause: pauseChangeDetection, resume: resumeChangeDetection } =
    useIntervalFn(checkAndRepaint, CHANGE_DETECTION_INTERVAL_MS, {
      immediate: false
    })

  // Polling is derived state, not something init() decides once. init() runs
  // synchronously from the immediate canvas watcher - before the template ref
  // has mounted - so any start decision taken there sees canvasRef as null and
  // the poll never starts. Deriving from the refs means the loop starts the
  // moment the canvas mounts and stops the moment any condition lapses.
  //
  // Document visibility is part of the condition because rAF was suspended
  // entirely on a hidden tab while setInterval is only clamped, and a tab that
  // is hidden at mount (middle-click, session restore) never fires a
  // visibilitychange to a transition-only watcher.
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
      graphManager.init()

      if (containerRef.value) {
        interaction.updateContainerRect()
      }
      viewport.updateCanvasDimensions()

      window.addEventListener('resize', interaction.updateContainerRect)
      window.addEventListener('scroll', interaction.updateContainerRect)
      window.addEventListener('resize', viewport.updateCanvasDimensions)

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
    graphManager.destroy()

    window.removeEventListener('resize', interaction.updateContainerRect)
    window.removeEventListener('scroll', interaction.updateContainerRect)
    window.removeEventListener('resize', viewport.updateCanvasDimensions)

    initialized.value = false
  }

  watch(
    canvas,
    async (newCanvas, oldCanvas) => {
      if (oldCanvas) {
        graphManager.cleanupEventListeners()
        pauseChangeDetection()
        viewport.stopViewportSync()
        graphManager.destroy()
        window.removeEventListener('resize', interaction.updateContainerRect)
        window.removeEventListener('scroll', interaction.updateContainerRect)
        window.removeEventListener('resize', viewport.updateCanvasDimensions)
      }
      if (newCanvas && !initialized.value) {
        await init()
      }
    },
    { immediate: true, flush: 'post' }
  )

  // Watch for graph changes (e.g., when navigating to/from subgraphs)
  watch(graph, (newGraph, oldGraph) => {
    if (newGraph && newGraph !== oldGraph) {
      graphManager.cleanupEventListeners(oldGraph || undefined)
      graphManager.setupEventListeners()
      if (!canDraw.value) return
      renderer.forceFullRedraw()
      renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
    }
  })

  watch(visible, async (isVisible) => {
    if (isVisible) {
      if (containerRef.value) {
        interaction.updateContainerRect()
      }
      viewport.updateCanvasDimensions()

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

  const setMinimapRef = (ref: HTMLElement | null) => {
    minimapRef.value = ref
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
    setMinimapRef,
    updateOption
  }
}
