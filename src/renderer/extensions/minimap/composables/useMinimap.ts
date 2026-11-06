import {
  useDocumentVisibility,
  useIntervalFn,
  usePreferredReducedMotion,
  useRafFn
} from '@vueuse/core'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { ShallowRef } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import {
  getMinimapDecorations,
  minimapDecorationRevision
} from '@/platform/canvas/minimapDecorationRegistry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'

import { MINIMAP_DECORATION_POP_MS } from '@/renderer/extensions/minimap/minimapCanvasRenderer'
import type { MinimapSettingsKey } from '@/renderer/extensions/minimap/types'
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
  const motionPreference = usePreferredReducedMotion()

  const width = 250
  const height = 200

  const canvas = computed(() => canvasStore.canvas ?? undefined)
  const graph = computed(
    () => workflowStore.activeSubgraph ?? canvas.value?.graph ?? undefined
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

  const viewport = useMinimapViewport(canvas, graph, width, height)

  const interaction = useMinimapInteraction(
    containerRef,
    viewport.bounds,
    viewport.scale,
    width,
    height,
    viewport.centerViewOn,
    canvas
  )

  const canDraw = computed(() => visible.value && !!canvasRef.value)

  const checkAndRepaint = () => {
    if (!canDraw.value) return
    if (graphManager.checkForChanges()) {
      renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
    }
  }

  const graphManager = useMinimapGraph(graph, () => checkAndRepaint())

  const renderer = useMinimapRenderer(
    canvasRef,
    graph,
    viewport.bounds,
    viewport.scale,
    graphManager.updateFlags,
    settings,
    width,
    height,
    decorations
  )

  const decorationFrames = useRafFn(
    () => {
      const now = performance.now()
      if (
        !canDraw.value ||
        decorations.value.every(
          ({ enteredAt }) =>
            enteredAt === undefined ||
            now - enteredAt >= MINIMAP_DECORATION_POP_MS
        )
      ) {
        decorationFrames.pause()
        return
      }
      renderer.forceFullRedraw()
      renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
    },
    { immediate: false }
  )

  const shouldAnimateDecorations = computed(
    () =>
      initialized.value &&
      canDraw.value &&
      decorations.value.some(
        ({ enteredAt }) =>
          enteredAt !== undefined &&
          performance.now() - enteredAt < MINIMAP_DECORATION_POP_MS
      )
  )

  watch(
    shouldAnimateDecorations,
    (active) => {
      if (!initialized.value || !canDraw.value) {
        decorationFrames.pause()
        return
      }
      renderer.forceFullRedraw()
      renderer.updateMinimap(viewport.updateBounds, viewport.updateViewport)
      if (active) decorationFrames.resume()
      else decorationFrames.pause()
    },
    { immediate: true }
  )

  const { pause: pauseChangeDetection, resume: resumeChangeDetection } =
    useIntervalFn(checkAndRepaint, CHANGE_DETECTION_INTERVAL_MS, {
      immediate: false
    })

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
    decorationFrames.pause()
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

  const viewportStyles = computed(() => {
    const transform = viewport.viewportTransform.value
    return {
      transform: `translate(${transform.x}px, ${transform.y}px)`,
      width: `${transform.width}px`,
      height: `${transform.height}px`,
      border: '2px solid var(--foreground)',
      backgroundColor: 'color-mix(in srgb, var(--foreground) 20%, transparent)',
      willChange: 'transform',
      backfaceVisibility: 'hidden' as const,
      perspective: '1000px',
      pointerEvents: 'none' as const
    }
  })

  return {
    visible: computed(() => visible.value),
    initialized: computed(() => initialized.value),
    decorationCount: computed(() => decorations.value.length),

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
