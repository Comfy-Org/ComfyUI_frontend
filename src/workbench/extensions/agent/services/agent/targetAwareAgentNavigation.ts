export type AgentTargetNavigationErrorCode =
  | 'missing_target'
  | 'closed_target'
  | 'activation_failed'
  | 'missing_node'

export class AgentTargetNavigationError extends Error {
  readonly recoverable = true

  constructor(
    readonly code: AgentTargetNavigationErrorCode,
    readonly workflowId: string,
    readonly locatorId?: string
  ) {
    super(`Agent navigation failed: ${code}`)
    this.name = 'AgentTargetNavigationError'
  }
}

export interface AgentGraphReference {
  workflowId: string
  locatorId: string
}

interface TargetAwareAgentNavigationDependencies<Tab, Node> {
  tabForWorkflow(workflowId: string): Tab | undefined
  isOpen(tab: Tab): boolean
  activate(tab: Tab): Promise<boolean>
  activeTab(): Tab | undefined
  resolveIn(tab: Tab, locatorId: string): Node | undefined
  focus(node: Node): void | Promise<void>
}

export function createTargetAwareAgentNavigation<Tab, Node>(
  dependencies: TargetAwareAgentNavigationDependencies<Tab, Node>
) {
  function target(reference: AgentGraphReference): Tab {
    const tab = dependencies.tabForWorkflow(reference.workflowId)
    if (tab === undefined)
      throw new AgentTargetNavigationError(
        'missing_target',
        reference.workflowId,
        reference.locatorId
      )
    if (!dependencies.isOpen(tab))
      throw new AgentTargetNavigationError(
        'closed_target',
        reference.workflowId,
        reference.locatorId
      )
    return tab
  }

  async function navigate(reference: AgentGraphReference): Promise<Node> {
    const tab = target(reference)
    if (!(await dependencies.activate(tab)))
      throw new AgentTargetNavigationError(
        'activation_failed',
        reference.workflowId,
        reference.locatorId
      )
    if (dependencies.activeTab() !== tab)
      throw new AgentTargetNavigationError(
        'activation_failed',
        reference.workflowId,
        reference.locatorId
      )
    const node = dependencies.resolveIn(tab, reference.locatorId)
    if (node === undefined)
      throw new AgentTargetNavigationError(
        'missing_node',
        reference.workflowId,
        reference.locatorId
      )
    await dependencies.focus(node)
    if (dependencies.activeTab() !== tab)
      throw new AgentTargetNavigationError(
        'activation_failed',
        reference.workflowId,
        reference.locatorId
      )
    return node
  }

  return { navigate }
}
