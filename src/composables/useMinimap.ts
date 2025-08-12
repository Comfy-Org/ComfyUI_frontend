import { useRafFn, useThrottleFn } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

import { useCanvasTransformSync } from '@/composables/canvas/useCanvasTransformSync'
import { LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'

interface GraphCallbacks {
  onNodeAdded?: (node: LGraphNode) => void
  onNodeRemoved?: (node: LGraphNode) => void
  onConnectionChange?: (node: LGraphNode) => void
}

export type MinimapOptionKey =
  | 'Comfy.Minimap.NodeColors'
  | 'Comfy.Minimap.ShowLinks'
  | 'Comfy.Minimap.ShowGroups'
  | 'Comfy.Minimap.RenderBypassState'
  | 'Comfy.Minimap.RenderErrorState'

export function useMinimap() {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const colorPaletteStore = useColorPaletteStore()

  const containerRef = ref<HTMLDivElement>()
  const canvasRef = ref<HTMLCanvasElement>()
  const minimapRef = ref<any>(null)

  const visible = ref(true)

  const nodeColors = computed(() =>
    settingStore.get('Comfy.Minimap.NodeColors')
  )
  const showLinks = computed(() => settingStore.get('Comfy.Minimap.ShowLinks'))
  const showGroups = computed(() =>
    settingStore.get('Comfy.Minimap.ShowGroups')
  )
  const renderBypass = computed(() =>
    settingStore.get('Comfy.Minimap.RenderBypassState')
  )
  const renderError = computed(() =>
    settingStore.get('Comfy.Minimap.RenderErrorState')
  )

  const updateOption = async (key: MinimapOptionKey, value: boolean) => {
    await settingStore.set(key, value)

    needsFullRedraw.value = true
    updateMinimap()
  }

  const initialized = ref(false)
  const bounds = ref({
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    width: 0,
    height: 0
  })
  const scale = ref(1)
  const isDragging = ref(false)
  const viewportTransform = ref({ x: 0, y: 0, width: 0, height: 0 })

  const needsFullRedraw = ref(true)
  const needsBoundsUpdate = ref(true)
  const lastNodeCount = ref(0)
  const nodeStatesCache = new Map<NodeId, string>()
  const linksCache = ref<string>('')

  const updateFlags = ref({
    bounds: false,
    nodes: false,
    connections: false,
    viewport: false
  })

  const width = 250
  const height = 200

  // Theme-aware colors for canvas drawing
  const isLightTheme = computed(
    () => colorPaletteStore.completedActivePalette.light_theme
  )
  const nodeColor = computed(
    () => (isLightTheme.value ? '#3DA8E099' : '#0B8CE999') // lighter blue for light theme
  )
  const nodeColorDefault = computed(
    () => (isLightTheme.value ? '#D9D9D9' : '#353535') // this is the default node color when using nodeColors setting
  )
  const linkColor = computed(
    () => (isLightTheme.value ? '#616161' : '#B3B3B3') // lighter orange for light theme
  )
  const slotColor = computed(() => linkColor.value)
  const groupColor = computed(() =>
    isLightTheme.value ? '#A2D3EC' : '#1F547A'
  )
  const bypassColor = computed(() =>
    isLightTheme.value ? '#DBDBDB' : '#4B184B'
  )

  const containerRect = ref({
    left: 0,
    top: 0,
    width: width,
    height: height
  })

  const canvasDimensions = ref({
    width: 0,
    height: 0
  })

  const updateContainerRect = () => {
    if (!containerRef.value) return

    const rect = containerRef.value.getBoundingClientRect()
    containerRect.value = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    }
  }

  const updateCanvasDimensions = () => {
    const c = canvas.value
    if (!c) return

    const canvasEl = c.canvas
    const dpr = window.devicePixelRatio || 1

    canvasDimensions.value = {
      width: canvasEl.clientWidth || canvasEl.width / dpr,
      height: canvasEl.clientHeight || canvasEl.height / dpr
    }
  }

  const canvas = computed(() => canvasStore.canvas)
  const graph = ref(app.canvas?.graph)

  const containerStyles = computed(() => ({
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: isLightTheme.value ? '#FAF9F5' : '#15161C',
    border: `1px solid ${isLightTheme.value ? '#ccc' : '#333'}`,
    borderRadius: '8px'
  }))

  const panelStyles = computed(() => ({
    width: `210px`,
    height: `${height}px`,
    backgroundColor: isLightTheme.value ? '#FAF9F5' : '#15161C',
    border: `1px solid ${isLightTheme.value ? '#ccc' : '#333'}`,
    borderRadius: '8px'
  }))

  const viewportStyles = computed(() => ({
    transform: `translate(${viewportTransform.value.x}px, ${viewportTransform.value.y}px)`,
    width: `${viewportTransform.value.width}px`,
    height: `${viewportTransform.value.height}px`,
    border: `2px solid ${isLightTheme.value ? '#E0E0E0' : '#FFF'}`,
    backgroundColor: `#FFF33`,
    willChange: 'transform',
    backfaceVisibility: 'hidden' as const,
    perspective: '1000px',
    pointerEvents: 'none' as const
  }))

  const calculateGraphBounds = () => {
    const g = graph.value
    if (!g || !g._nodes || g._nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of g._nodes) {
      minX = Math.min(minX, node.pos[0])
      minY = Math.min(minY, node.pos[1])
      maxX = Math.max(maxX, node.pos[0] + node.size[0])
      maxY = Math.max(maxY, node.pos[1] + node.size[1])
    }

    let currentWidth = maxX - minX
    let currentHeight = maxY - minY

    // Enforce minimum viewport dimensions for better visualization
    const minViewportWidth = 2500
    const minViewportHeight = 2000

    if (currentWidth < minViewportWidth) {
      const padding = (minViewportWidth - currentWidth) / 2
      minX -= padding
      maxX += padding
      currentWidth = minViewportWidth
    }

    if (currentHeight < minViewportHeight) {
      const padding = (minViewportHeight - currentHeight) / 2
      minY -= padding
      maxY += padding
      currentHeight = minViewportHeight
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: currentWidth,
      height: currentHeight
    }
  }

  const calculateScale = () => {
    if (bounds.value.width === 0 || bounds.value.height === 0) {
      return 1
    }

    const scaleX = width / bounds.value.width
    const scaleY = height / bounds.value.height

    // Apply 0.9 factor to provide padding/gap between nodes and minimap borders
    return Math.min(scaleX, scaleY) * 0.9
  }

  const renderGroups = (
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number
  ) => {
    const g = graph.value
    if (!g || !g._groups || g._groups.length === 0) return

    for (const group of g._groups) {
      const x = (group.pos[0] - bounds.value.minX) * scale.value + offsetX
      const y = (group.pos[1] - bounds.value.minY) * scale.value + offsetY
      const w = group.size[0] * scale.value
      const h = group.size[1] * scale.value

      ctx.fillStyle = groupColor.value
      ctx.fillRect(x, y, w, h)
    }
  }

  const renderNodes = (
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number
  ) => {
    const g = graph.value
    if (!g || !g._nodes || g._nodes.length === 0) return

    for (const node of g._nodes) {
      const x = (node.pos[0] - bounds.value.minX) * scale.value + offsetX
      const y = (node.pos[1] - bounds.value.minY) * scale.value + offsetY
      const w = node.size[0] * scale.value
      const h = node.size[1] * scale.value

      let color = nodeColor.value

      if (renderBypass.value && node.mode === LGraphEventMode.BYPASS) {
        color = bypassColor.value
      } else if (nodeColors.value) {
        color = nodeColorDefault.value

        if (node.bgcolor) {
          color = isLightTheme.value
            ? adjustColor(node.bgcolor, { lightness: 0.5 })
            : node.bgcolor
        }
      }

      // Render solid node blocks
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)

      if (renderError.value && node.has_errors) {
        ctx.strokeStyle = '#FF0000'
        ctx.lineWidth = 0.3
        ctx.strokeRect(x, y, w, h)
      }
    }
  }

  const renderConnections = (
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number
  ) => {
    const g = graph.value
    if (!g) return

    ctx.strokeStyle = linkColor.value
    ctx.lineWidth = 0.3

    const slotRadius = Math.max(scale.value, 0.5) // Larger slots that scale
    const connections: Array<{
      x1: number
      y1: number
      x2: number
      y2: number
    }> = []

    for (const node of g._nodes) {
      if (!node.outputs) continue

      const x1 = (node.pos[0] - bounds.value.minX) * scale.value + offsetX
      const y1 = (node.pos[1] - bounds.value.minY) * scale.value + offsetY

      for (const output of node.outputs) {
        if (!output.links) continue

        for (const linkId of output.links) {
          const link = g.links[linkId]
          if (!link) continue

          const targetNode = g.getNodeById(link.target_id)
          if (!targetNode) continue

          const x2 =
            (targetNode.pos[0] - bounds.value.minX) * scale.value + offsetX
          const y2 =
            (targetNode.pos[1] - bounds.value.minY) * scale.value + offsetY

          const outputX = x1 + node.size[0] * scale.value
          const outputY = y1 + node.size[1] * scale.value * 0.2
          const inputX = x2
          const inputY = y2 + targetNode.size[1] * scale.value * 0.2

          // Draw connection line
          ctx.beginPath()
          ctx.moveTo(outputX, outputY)
          ctx.lineTo(inputX, inputY)
          ctx.stroke()

          connections.push({ x1: outputX, y1: outputY, x2: inputX, y2: inputY })
        }
      }
    }

    // Render connection slots on top
    ctx.fillStyle = slotColor.value
    for (const conn of connections) {
      // Output slot
      ctx.beginPath()
      ctx.arc(conn.x1, conn.y1, slotRadius, 0, Math.PI * 2)
      ctx.fill()

      // Input slot
      ctx.beginPath()
      ctx.arc(conn.x2, conn.y2, slotRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const renderMinimap = () => {
    const g = graph.value
    if (!canvasRef.value || !g) return

    const ctx = canvasRef.value.getContext('2d')
    if (!ctx) return

    // Fast path for 0 nodes - just show background
    if (!g._nodes || g._nodes.length === 0) {
      ctx.clearRect(0, 0, width, height)
      return
    }

    const needsRedraw =
      needsFullRedraw.value ||
      updateFlags.value.nodes ||
      updateFlags.value.connections

    if (needsRedraw) {
      ctx.clearRect(0, 0, width, height)

      const offsetX = (width - bounds.value.width * scale.value) / 2
      const offsetY = (height - bounds.value.height * scale.value) / 2

      if (showGroups.value) {
        renderGroups(ctx, offsetX, offsetY)
      }

      if (showLinks.value) {
        renderConnections(ctx, offsetX, offsetY)
      }

      renderNodes(ctx, offsetX, offsetY)

      needsFullRedraw.value = false
      updateFlags.value.nodes = false
      updateFlags.value.connections = false
    }
  }

  const updateViewport = () => {
    const c = canvas.value
    if (!c) return

    if (
      canvasDimensions.value.width === 0 ||
      canvasDimensions.value.height === 0
    ) {
      updateCanvasDimensions()
    }

    const ds = c.ds

    const viewportWidth = canvasDimensions.value.width / ds.scale
    const viewportHeight = canvasDimensions.value.height / ds.scale

    const worldX = -ds.offset[0]
    const worldY = -ds.offset[1]

    const centerOffsetX = (width - bounds.value.width * scale.value) / 2
    const centerOffsetY = (height - bounds.value.height * scale.value) / 2

    viewportTransform.value = {
      x: (worldX - bounds.value.minX) * scale.value + centerOffsetX,
      y: (worldY - bounds.value.minY) * scale.value + centerOffsetY,
      width: viewportWidth * scale.value,
      height: viewportHeight * scale.value
    }

    updateFlags.value.viewport = false
  }

  const updateMinimap = () => {
    if (needsBoundsUpdate.value || updateFlags.value.bounds) {
      bounds.value = calculateGraphBounds()
      scale.value = calculateScale()
      needsBoundsUpdate.value = false
      updateFlags.value.bounds = false
      needsFullRedraw.value = true
      // When bounds change, we need to update the viewport position
      updateFlags.value.viewport = true
    }

    if (
      needsFullRedraw.value ||
      updateFlags.value.nodes ||
      updateFlags.value.connections
    ) {
      renderMinimap()
    }

    // Update viewport if needed (e.g., after bounds change)
    if (updateFlags.value.viewport) {
      updateViewport()
    }
  }

  const checkForChanges = useThrottleFn(() => {
    const g = graph.value
    if (!g) return

    let structureChanged = false
    let positionChanged = false
    let connectionChanged = false

    if (g._nodes.length !== lastNodeCount.value) {
      structureChanged = true
      lastNodeCount.value = g._nodes.length
    }

    for (const node of g._nodes) {
      const key = node.id
      const currentState = `${node.pos[0]},${node.pos[1]},${node.size[0]},${node.size[1]}`

      if (nodeStatesCache.get(key) !== currentState) {
        positionChanged = true
        nodeStatesCache.set(key, currentState)
      }
    }

    const currentLinks = JSON.stringify(g.links || {})
    if (currentLinks !== linksCache.value) {
      connectionChanged = true
      linksCache.value = currentLinks
    }

    const currentNodeIds = new Set(g._nodes.map((n) => n.id))
    for (const [nodeId] of nodeStatesCache) {
      if (!currentNodeIds.has(nodeId)) {
        nodeStatesCache.delete(nodeId)
        structureChanged = true
      }
    }

    if (structureChanged || positionChanged) {
      updateFlags.value.bounds = true
      updateFlags.value.nodes = true
    }

    if (connectionChanged) {
      updateFlags.value.connections = true
    }

    if (structureChanged || positionChanged || connectionChanged) {
      updateMinimap()
    }
  }, 500)

  const { pause: pauseChangeDetection, resume: resumeChangeDetection } =
    useRafFn(
      async () => {
        if (visible.value) {
          await checkForChanges()
        }
      },
      { immediate: false }
    )

  const { startSync: startViewportSync, stopSync: stopViewportSync } =
    useCanvasTransformSync(updateViewport, { autoStart: false })

  // Pointer event handlers for touch screen support
  const handlePointerDown = (e: PointerEvent) => {
    isDragging.value = true
    updateContainerRect()
    handlePointerMove(e)
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging.value || !canvasRef.value || !canvas.value) return

    const x = e.clientX - containerRect.value.left
    const y = e.clientY - containerRect.value.top

    const offsetX = (width - bounds.value.width * scale.value) / 2
    const offsetY = (height - bounds.value.height * scale.value) / 2

    const worldX = (x - offsetX) / scale.value + bounds.value.minX
    const worldY = (y - offsetY) / scale.value + bounds.value.minY

    centerViewOn(worldX, worldY)
  }

  const handlePointerUp = () => {
    isDragging.value = false
  }

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()

    const c = canvas.value
    if (!c) return

    if (
      containerRect.value.left === 0 &&
      containerRect.value.top === 0 &&
      containerRef.value
    ) {
      updateContainerRect()
    }

    const ds = c.ds
    const delta = e.deltaY > 0 ? 0.9 : 1.1

    const newScale = ds.scale * delta

    const MIN_SCALE = 0.1
    const MAX_SCALE = 10

    if (newScale < MIN_SCALE || newScale > MAX_SCALE) return

    const x = e.clientX - containerRect.value.left
    const y = e.clientY - containerRect.value.top

    const offsetX = (width - bounds.value.width * scale.value) / 2
    const offsetY = (height - bounds.value.height * scale.value) / 2

    const worldX = (x - offsetX) / scale.value + bounds.value.minX
    const worldY = (y - offsetY) / scale.value + bounds.value.minY

    ds.scale = newScale

    centerViewOn(worldX, worldY)
  }

  const centerViewOn = (worldX: number, worldY: number) => {
    const c = canvas.value
    if (!c) return

    if (
      canvasDimensions.value.width === 0 ||
      canvasDimensions.value.height === 0
    ) {
      updateCanvasDimensions()
    }

    const ds = c.ds

    const viewportWidth = canvasDimensions.value.width / ds.scale
    const viewportHeight = canvasDimensions.value.height / ds.scale

    ds.offset[0] = -(worldX - viewportWidth / 2)
    ds.offset[1] = -(worldY - viewportHeight / 2)

    updateFlags.value.viewport = true

    c.setDirty(true, true)
  }

  let originalCallbacks: GraphCallbacks = {}

  const handleGraphChanged = useThrottleFn(() => {
    needsFullRedraw.value = true
    updateFlags.value.bounds = true
    updateFlags.value.nodes = true
    updateFlags.value.connections = true
    updateMinimap()
  }, 500)

  const setupEventListeners = () => {
    const g = graph.value
    if (!g) return

    originalCallbacks = {
      onNodeAdded: g.onNodeAdded,
      onNodeRemoved: g.onNodeRemoved,
      onConnectionChange: g.onConnectionChange
    }

    g.onNodeAdded = function (node) {
      originalCallbacks.onNodeAdded?.call(this, node)

      void handleGraphChanged()
    }

    g.onNodeRemoved = function (node) {
      originalCallbacks.onNodeRemoved?.call(this, node)
      nodeStatesCache.delete(node.id)
      void handleGraphChanged()
    }

    g.onConnectionChange = function (node) {
      originalCallbacks.onConnectionChange?.call(this, node)

      void handleGraphChanged()
    }
  }

  const cleanupEventListeners = () => {
    const g = graph.value
    if (!g) return

    if (originalCallbacks.onNodeAdded !== undefined) {
      g.onNodeAdded = originalCallbacks.onNodeAdded
    }
    if (originalCallbacks.onNodeRemoved !== undefined) {
      g.onNodeRemoved = originalCallbacks.onNodeRemoved
    }
    if (originalCallbacks.onConnectionChange !== undefined) {
      g.onConnectionChange = originalCallbacks.onConnectionChange
    }
  }

  const init = async () => {
    if (initialized.value) return

    visible.value = settingStore.get('Comfy.Minimap.Visible')

    if (canvas.value && graph.value) {
      setupEventListeners()

      api.addEventListener('graphChanged', handleGraphChanged)

      if (containerRef.value) {
        updateContainerRect()
      }
      updateCanvasDimensions()

      window.addEventListener('resize', updateContainerRect)
      window.addEventListener('scroll', updateContainerRect)
      window.addEventListener('resize', updateCanvasDimensions)

      needsFullRedraw.value = true
      updateFlags.value.bounds = true
      updateFlags.value.nodes = true
      updateFlags.value.connections = true
      updateFlags.value.viewport = true

      updateMinimap()
      updateViewport()

      if (visible.value) {
        resumeChangeDetection()
        startViewportSync()
      }
      initialized.value = true
    }
  }

  const destroy = () => {
    pauseChangeDetection()
    stopViewportSync()
    cleanupEventListeners()

    api.removeEventListener('graphChanged', handleGraphChanged)

    window.removeEventListener('resize', updateContainerRect)
    window.removeEventListener('scroll', updateContainerRect)
    window.removeEventListener('resize', updateCanvasDimensions)

    nodeStatesCache.clear()
    initialized.value = false
  }

  watch(
    canvas,
    async (newCanvas, oldCanvas) => {
      if (oldCanvas) {
        cleanupEventListeners()
        pauseChangeDetection()
        stopViewportSync()
        api.removeEventListener('graphChanged', handleGraphChanged)
        window.removeEventListener('resize', updateContainerRect)
        window.removeEventListener('scroll', updateContainerRect)
        window.removeEventListener('resize', updateCanvasDimensions)
      }
      if (newCanvas && !initialized.value) {
        await init()
      }
    },
    { immediate: true, flush: 'post' }
  )

  watch(visible, async (isVisible) => {
    if (isVisible) {
      if (containerRef.value) {
        updateContainerRect()
      }
      updateCanvasDimensions()

      needsFullRedraw.value = true
      updateFlags.value.bounds = true
      updateFlags.value.nodes = true
      updateFlags.value.connections = true
      updateFlags.value.viewport = true

      await nextTick()

      await nextTick()

      updateMinimap()
      updateViewport()
      resumeChangeDetection()
      startViewportSync()
    } else {
      pauseChangeDetection()
      stopViewportSync()
    }
  })

  const toggle = async () => {
    visible.value = !visible.value
    await settingStore.set('Comfy.Minimap.Visible', visible.value)
  }

  const setMinimapRef = (ref: any) => {
    minimapRef.value = ref
  }

  return {
    visible: computed(() => visible.value),
    initialized: computed(() => initialized.value),

    containerRef,
    canvasRef,
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
    renderMinimap,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    setMinimapRef,
    updateOption
  }
}
