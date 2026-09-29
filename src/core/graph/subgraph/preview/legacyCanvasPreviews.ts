import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  getPreviewExposureHostLocator,
  usePreviewExposureStore
} from '@/stores/previewExposureStore'

import {
  readExposedPreviewUrls,
  resolveExposureLeaf
} from '@/composables/node/usePromotedPreviews'

const PREVIEW_WIDGET_PREFIX = '$$promoted-preview-'
const FALLBACK_ASPECT = 2

interface AsyncImage {
  ready?: boolean
  naturalWidth: number
  naturalHeight: number
}

interface ExposedPreviewWidget extends IBaseWidget {
  state: {
    requestedUrl?: string
    image?: AsyncImage
    failedUrl?: string
  }
}

function exposureKey(exposure: PreviewExposure): string {
  return `${String(exposure.sourceNodeId)}:${exposure.sourcePreviewName}`
}

export function isLegacyPreviewWidgetName(name: string): boolean {
  return name.startsWith(PREVIEW_WIDGET_PREFIX)
}

function resolveLatestUrl(
  host: SubgraphNode,
  exposure: PreviewExposure,
  nodeOutputStore: ReturnType<typeof useNodeOutputStore>
): string | undefined {
  const leaf = resolveExposureLeaf(host, exposure)
  if (!leaf) return undefined
  const interiorNode = leaf.leafHost.subgraph.getNodeById(leaf.leafSourceNodeId)
  if (!interiorNode) return undefined
  return readExposedPreviewUrls(nodeOutputStore, leaf, interiorNode, false)?.at(
    -1
  )
}

function createPreviewWidget(
  host: SubgraphNode,
  exposure: PreviewExposure
): ExposedPreviewWidget {
  const nodeOutputStore = useNodeOutputStore()
  const widget: ExposedPreviewWidget = {
    name: `${PREVIEW_WIDGET_PREFIX}${exposureKey(exposure)}`,
    type: 'promo_preview',
    value: null,
    options: { serialize: false },
    serialize: false,
    y: 0,
    computedDisabled: false,
    state: {},

    computeSize(): [number, number] {
      const width = host.size[0] - 4
      const img = widget.state.image
      const height =
        img?.ready && img.naturalWidth
          ? Math.max(24, width / (img.naturalWidth / img.naturalHeight))
          : width / FALLBACK_ASPECT
      return [host.size[0], height]
    },

    // Widget drawing runs in node-local space (LGraphCanvas translates to
    // the node origin before drawing widgets).
    draw(
      ctx: CanvasRenderingContext2D,
      _node: LGraphNode,
      width: number,
      y: number
    ): void {
      const url = resolveLatestUrl(host, exposure, nodeOutputStore)
      if (!url || url === widget.state.failedUrl) {
        widget.state.image = undefined
        return
      }

      if (widget.state.requestedUrl !== url) {
        widget.state.requestedUrl = url
        // node.loadImage flags `ready` and re-dirties the canvas on load;
        // the row re-arranges itself on the next draw.
        widget.state.image = loadPreviewImage(host, url)
        return
      }
      const img = widget.state.image
      if (!img?.ready || !img.naturalWidth) return

      const boxWidth = width - 4
      const drawHeight = boxWidth / (img.naturalWidth / img.naturalHeight)
      ctx.drawImage(
        img as unknown as CanvasImageSource,
        2,
        y + 2,
        boxWidth,
        drawHeight
      )
    }
  }
  return widget
}

function loadPreviewImage(host: SubgraphNode, url: string): AsyncImage {
  return host.loadImage(url)
}

/**
 * Mirrors exposed previews (which Nodes 2.0 renders in the host header) into
 * canvas-widget rows so the classic renderer shows the same images.
 */
export function syncLegacyPreviewWidgets(host: SubgraphNode): void {
  const hostLocator = LiteGraph.vueNodesMode
    ? undefined
    : getPreviewExposureHostLocator(host)
  const exposures = hostLocator
    ? usePreviewExposureStore().getExposures(host.rootGraph.id, hostLocator)
    : []

  const wanted = new Map(
    exposures.map((exposure) => [
      `${PREVIEW_WIDGET_PREFIX}${exposureKey(exposure)}`,
      exposure
    ])
  )
  const current = host.widgets.filter((widget) =>
    isLegacyPreviewWidgetName(widget.name)
  )
  let changed = false

  for (const widget of current) {
    if (wanted.has(widget.name)) continue
    host.removeWidget(widget)
    changed = true
  }
  for (const [name, exposure] of wanted) {
    if (current.some((widget) => widget.name === name)) continue
    host.addCustomWidget(createPreviewWidget(host, exposure))
    changed = true
  }
  if (!changed) return

  host.arrange()
  host.setDirtyCanvas(true, true)
}
