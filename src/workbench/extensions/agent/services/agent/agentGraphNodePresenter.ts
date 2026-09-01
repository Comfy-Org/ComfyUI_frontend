import type { AgentGraphBuildPoint } from './agentGraphBuildPlayback'

export function createAgentGraphNodePresenter(
  nodeId: string | number,
  target: AgentGraphBuildPoint,
  isCurrentGraph: () => boolean = () => true
): (position: AgentGraphBuildPoint | null) => void {
  let element: HTMLElement | null = null

  return (position) => {
    if (position !== null && !isCurrentGraph()) return

    if (!element?.isConnected) {
      const nodes = document.querySelectorAll<HTMLElement>(
        '#graph-canvas-container .lg-node[data-node-id]'
      )
      element =
        [...nodes].find(({ dataset }) => dataset.nodeId === String(nodeId)) ??
        null
    }
    if (!element) return

    if (position === null) {
      element.style.removeProperty('translate')
      element.style.removeProperty('will-change')
      return
    }

    element.style.setProperty(
      'translate',
      `${position.x - target.x}px ${position.y - target.y}px`
    )
    element.style.setProperty('will-change', 'translate')
  }
}
