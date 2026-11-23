import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { ObjectInfoResponse } from '@comfyorg/object-info-parser'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { EcosystemSimulacra, WorkspaceStore } from '@e2e/types/globals'

type SimulacraRecord = Omit<EcosystemSimulacra, 'timersHeld' | 'releaseTimers'>

export function readEcosystemSimulacra(
  comfyPage: ComfyPage
): Promise<SimulacraRecord> {
  return comfyPage.page.evaluate(() => {
    const {
      lifecycle,
      registry,
      promptExecuted,
      executed,
      added,
      removed,
      timerErrors,
      navigation
    } = window.__ecosystemSimulacra!
    return {
      lifecycle,
      registry,
      promptExecuted,
      executed,
      added,
      removed,
      timerErrors,
      navigation: { groups: navigation.groups }
    }
  })
}

export function activeRootId(comfyPage: ComfyPage): Promise<string> {
  return comfyPage.page.evaluate(() => window.app!.rootGraph.id)
}

export function undoWorkflowInBackground(
  comfyPage: ComfyPage,
  index: number
): Promise<void> {
  return comfyPage.page.evaluate(async (index) => {
    const store = (window.app!.extensionManager as WorkspaceStore).workflow
    const tracker = store.openWorkflows[index].changeTracker
    if (!tracker) throw new Error(`Workflow ${index} has no change tracker`)
    await tracker.undo()
  }, index)
}

export function captureUndoCheckpoint(comfyPage: ComfyPage): Promise<void> {
  return comfyPage.page.evaluate(() =>
    (
      window.app!.extensionManager as WorkspaceStore
    ).workflow.activeWorkflow?.changeTracker.captureCanvasState()
  )
}

export function undoQueueLength(comfyPage: ComfyPage): Promise<number> {
  return comfyPage.page.evaluate(
    () =>
      (window.app!.extensionManager as WorkspaceStore).workflow.activeWorkflow
        ?.changeTracker.undoQueue.length ?? 0
  )
}

export function releaseHeldTimers(comfyPage: ComfyPage): Promise<void> {
  return comfyPage.page.evaluate(() =>
    window.__ecosystemSimulacra!.releaseTimers()
  )
}

export function heldTimerCount(comfyPage: ComfyPage): Promise<number> {
  return comfyPage.page.evaluate(() =>
    window.__ecosystemSimulacra!.timersHeld()
  )
}

export function connectUnbatchToPreview(comfyPage: ComfyPage): Promise<void> {
  return comfyPage.page.evaluate(() => {
    const { LiteGraph } = window
    const graph = window.app!.rootGraph
    const source = LiteGraph!.createNode('LoadImage')!
    const unbatch = LiteGraph!.createNode('DevToolsSimulacraUnbatch')!
    const preview = LiteGraph!.createNode('PreviewImage')!
    graph.add(source)
    graph.add(unbatch)
    graph.add(preview)
    source.connect(0, unbatch, 0)
    window.__ecosystemSimulacra!.releaseTimers()
    unbatch.connect(0, preview, 0)
  })
}

export function linkCountsByOpenWorkflow(
  comfyPage: ComfyPage
): Promise<number[]> {
  return comfyPage.page.evaluate(() =>
    (window.app!.extensionManager as WorkspaceStore).workflow.openWorkflows.map(
      (workflow) => workflow.graph?.links.size ?? -1
    )
  )
}

export function startLatentPreviewOnNode(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<void> {
  return comfyPage.page.evaluate((id) => {
    EventTarget.prototype.dispatchEvent.call(
      window.app!.api,
      new CustomEvent('VHS_latentpreview', {
        detail: { id, length: 1, rate: 8 }
      })
    )
  }, nodeId)
}

export function latentPreviewWidgetsByOpenWorkflow(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<boolean[]> {
  return comfyPage.page.evaluate(
    (id) =>
      (
        window.app!.extensionManager as WorkspaceStore
      ).workflow.openWorkflows.map(
        (workflow) =>
          !!workflow.graph
            ?.getNodeById(id)
            ?.widgets?.some((widget) => widget.name === 'vhslatentpreview')
      ),
    toNodeId(nodeId)
  )
}

export function queueUnbatchTypeChange(
  comfyPage: ComfyPage,
  type: string
): Promise<void> {
  return comfyPage.page.evaluate((type) => {
    const unbatch = window.app!.rootGraph.nodes.find(
      (node) => node.type === 'DevToolsSimulacraUnbatch'
    )
    const changeOutputType: unknown = unbatch
      ? Reflect.get(unbatch, 'changeOutputType')
      : undefined
    if (typeof changeOutputType !== 'function')
      throw new Error('No simulacrum Unbatch node in the active workflow')
    Reflect.apply(changeOutputType, unbatch, [type])
  }, type)
}

export function seedNavigationGroups(
  comfyPage: ComfyPage,
  groups: unknown[]
): Promise<void> {
  return comfyPage.page.evaluate((groups) => {
    window.__ecosystemSimulacra!.navigation.groups = groups
  }, groups)
}

export function addPreMatchTypeVhsUnbatch(objectInfo: ObjectInfoResponse) {
  objectInfo.VHS_Unbatch = {
    name: 'VHS_Unbatch',
    display_name: 'Unbatch 🎥🅥🅗🅢',
    description: '',
    category: 'Video Helper Suite 🎥🅥🅗🅢',
    python_module: 'custom_nodes.ComfyUI-VideoHelperSuite',
    output_node: false,
    input: { required: { batched: ['*'] } },
    output: ['*'],
    output_name: ['unbatched'],
    output_is_list: [false]
  }
}
