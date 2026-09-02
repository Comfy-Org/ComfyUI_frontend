import type { AgentGraphBuildPoint } from './agentGraphBuildPlayback'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'

export interface AgentGraphNodePresenter {
  prepare(): void
  present(position: AgentGraphBuildPoint | null): void
}

/**
 * Presents the real DOM-rendered node as a drag without changing its
 * authoritative CRDT layout. Queued nodes stay hidden until their turn;
 * cleanup removes every temporary inline style and leaves the final node.
 */
export function createAgentGraphNodePresenter(
  nodeId: string | number,
  target: AgentGraphBuildPoint,
  isCurrentGraph: () => boolean = () => true
): AgentGraphNodePresenter {
  let element: HTMLElement | null = null
  let stagedElement: HTMLElement | null = null
  let stagedVisibility = ''

  function resolveElement(): HTMLElement | null {
    if (!element?.isConnected) {
      const nodes = document.querySelectorAll<HTMLElement>(
        '#graph-canvas-container .lg-node[data-node-id]'
      )
      element =
        [...nodes].find(({ dataset }) => dataset.nodeId === String(nodeId)) ??
        null
    }
    return element
  }

  function restoreStagedVisibility(): void {
    if (stagedElement?.style.visibility === 'hidden')
      stagedElement.style.visibility = stagedVisibility
    stagedElement = null
    stagedVisibility = ''
  }

  function prepare(): void {
    if (!isCurrentGraph()) return
    const node = resolveElement()
    if (!node) return
    stagedElement = node
    stagedVisibility = node.style.visibility
    node.style.visibility = 'hidden'
  }

  function present(position: AgentGraphBuildPoint | null): void {
    if (position !== null && !isCurrentGraph()) return

    if (position === null) {
      restoreStagedVisibility()
      if (element?.isConnected) {
        element.style.removeProperty('translate')
        element.style.removeProperty('will-change')
      }
      return
    }

    const node = resolveElement()
    if (!node) return
    restoreStagedVisibility()

    node.style.setProperty(
      'translate',
      `${position.x - target.x}px ${position.y - target.y}px`
    )
    node.style.setProperty('will-change', 'translate')
  }

  return { prepare, present }
}

export function suspendAgentGraphConnections(
  canvas: LGraphCanvas | null
): () => void {
  if (!canvas) return () => {}
  const previousMode = canvas.links_render_mode
  canvas.links_render_mode = LinkRenderType.HIDDEN_LINK
  canvas.setDirty(true, true)
  return () => {
    if (canvas.links_render_mode === LinkRenderType.HIDDEN_LINK)
      canvas.links_render_mode = previousMode
    canvas.setDirty(true, true)
  }
}
