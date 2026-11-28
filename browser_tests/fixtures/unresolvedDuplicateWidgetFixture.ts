import type { Locator, TestInfo } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

const NODE_TYPE = 'DevToolsNodeWithOutputList'

class UnresolvedDuplicateWidgetScenario {
  private constructor(
    private readonly comfyPage: ComfyPage,
    public readonly nodeId: string,
    public readonly node: Locator,
    public readonly workflowName: string
  ) {}

  static async create(
    comfyPage: ComfyPage,
    testInfo: TestInfo
  ): Promise<UnresolvedDuplicateWidgetScenario> {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.page.evaluate(
      ({ nodeTypeName }) => {
        const nodeType = window.LiteGraph!.registered_node_types[nodeTypeName]
        const onNodeCreated = nodeType.prototype.onNodeCreated
        nodeType.prototype.onNodeCreated = function (...args) {
          onNodeCreated?.apply(this, args)
          this.serialize_widgets = true
          this.addWidget('string', 'alpha', 'first default', () => {})
          this.addWidget('string', 'beta', 'second default', () => {})
          this.addWidget('string', 'gamma', 'third default', () => {})
        }
      },
      { nodeTypeName: NODE_TYPE }
    )

    const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
      'Node With Output List'
    )
    const node = comfyPage.vueNodes.getNodeLocator(nodeId)
    const workflowName = `renamable-duplicate-widget-${testInfo.parallelIndex}-${testInfo.retry}-${Date.now()}`
    return new UnresolvedDuplicateWidgetScenario(
      comfyPage,
      nodeId,
      node,
      workflowName
    )
  }

  async collideNames(): Promise<string[]> {
    const names = await this.comfyPage.page.evaluate(
      ({ nodeId }) => {
        const graph = window.app!.graph
        const node = graph.nodes.find(
          (candidate) => String(candidate.id) === nodeId
        )
        if (!node) throw new Error(`node ${nodeId} not found`)

        graph.remove(node)
        const target = node.widgets?.find(({ name }) => name === 'beta')
        if (!target) throw new Error('widget beta not found')
        target.name = 'alpha'
        Object.defineProperty(target, 'name', {
          get: () => 'alpha',
          set: () => undefined,
          configurable: true
        })
        graph.add(node)
        return (node.widgets ?? []).map(({ name }) => name)
      },
      { nodeId: this.nodeId }
    )
    await this.comfyPage.nextFrame()
    return names
  }

  async saveValues(): Promise<unknown> {
    const savedRequest = this.comfyPage.page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        decodeURIComponent(new URL(request.url()).pathname).endsWith(
          `/workflows/${this.workflowName}.json`
        )
    )
    await this.comfyPage.menu.topbar.saveWorkflowAs(this.workflowName)
    const saved = zComfyWorkflow.parse(
      JSON.parse((await savedRequest).postData() ?? '{}')
    )
    return saved.nodes.find(({ type }) => type === NODE_TYPE)?.widgets_values
  }
}

const unresolvedDuplicateWidgetFixture = base.extend<{
  comfyPage: ComfyPage
  unresolvedDuplicateWidget: UnresolvedDuplicateWidgetScenario
}>({
  unresolvedDuplicateWidget: async ({ comfyPage }, use, testInfo) => {
    const scenario = await UnresolvedDuplicateWidgetScenario.create(
      comfyPage,
      testInfo
    )
    await use(scenario)
    await comfyPage.workflow.deleteWorkflow(scenario.workflowName)
  }
})

export const test = mergeTests(
  comfyPageFixture,
  unresolvedDuplicateWidgetFixture
)
