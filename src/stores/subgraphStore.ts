import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { t } from '@/i18n'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeError } from '@/schemas/apiSchema'
import type {
  ComfyNode,
  ComfyWorkflowJSON,
  NodeId
} from '@/schemas/comfyWorkflowSchema'
import type {
  ComfyNodeDef as ComfyNodeDefV1,
  InputSpec
} from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useWorkflowService } from '@/services/workflowService'
import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/stores/graphStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { UserFile } from '@/stores/userFileStore'
import {
  ComfyWorkflow,
  LoadedComfyWorkflow,
  useWorkflowStore
} from '@/stores/workflowStore'

export class SubgraphBlueprint extends ComfyWorkflow {
  static override readonly basePath = 'subgraphs/'

  hasPromptedSave: boolean = false

  validateSubgraph() {
    if (!this.activeState?.definitions)
      throw new Error(
        'The root graph of a subgraph blueprint must consist of only a single subgraph node'
      )
    const subgraphs = this.activeState.definitions.subgraphs
    const nodes = this.activeState.nodes
    //Instanceof doesn't funciton as nodes are serialized
    function isSubgraphNode(node: ComfyNode) {
      return node && subgraphs.some((s) => s.id == node.type)
    }
    if (nodes.length == 1 && isSubgraphNode(nodes[0])) return
    const errors: Record<NodeId, NodeError> = {}
    //mark errors for all but first subgraph node
    let firstSubgraphFound = false
    for (let i = 0; i < nodes.length; i++) {
      if (!firstSubgraphFound && isSubgraphNode(nodes[i])) {
        firstSubgraphFound = true
        continue
      }
      errors[nodes[i].id] = {
        errors: [],
        class_type: nodes[i].type,
        dependent_outputs: []
      }
    }
    useExecutionStore().lastNodeErrors = errors
    useCanvasStore().getCanvas().draw(true, true)
    throw new Error(
      'The root graph of a subgraph blueprint must consist of only a single subgraph node'
    )
  }

  override async save(): Promise<UserFile> {
    this.validateSubgraph()
    if (!this.hasPromptedSave) {
      //Swap to saveAs?
      const newname = await useDialogService().prompt({
        title: t('subgraphStore.saveBlueprint'),
        message: t('subgraphStore.blueprintName') + ':',
        defaultValue: this.filename
      })
      if (!newname) return this
      this.hasPromptedSave = true
      this.updatePath(SubgraphBlueprint.basePath + newname + '.json')
    }
    useSubgraphStore().updateDef(this as LoadedComfyWorkflow)
    return super.save()
  }

  //TODO: reconsider semantics here with promptonce
  //Should update current name, but keep true?
  override async saveAs(path: string) {
    this.validateSubgraph()
    this.hasPromptedSave = true
    useSubgraphStore().updateDef(this as LoadedComfyWorkflow)
    return await super.saveAs(path)
  }
}

const subgraphCache: Record<string, LoadedComfyWorkflow> = {}

export const useSubgraphStore = defineStore('subgraph', () => {
  const typePrefix = 'SubgraphBlueprint'
  const subgraphDefCache = ref<Map<string, ComfyNodeDefImpl>>(new Map())
  const canvasStore = useCanvasStore()
  const dialogService = useDialogService()
  const subgraphBlueprints = computed(() => [
    ...subgraphDefCache.value.values()
  ])
  //TODO: On initialization, send background request to resolve definitions.
  //TODO: Find someway to actually signal that information is not ready for synchronous queries
  async function fetchSubgraphs() {
    //TODO: lighten this call?
    const res = (
      await api.listUserDataFullInfo(SubgraphBlueprint.basePath)
    ).filter((f) => f.path.endsWith('.json'))
    await Promise.all(
      res.map(async (f) => {
        const name = f.path.slice(0, -5)
        f.path = SubgraphBlueprint.basePath + f.path
        const bp = await new SubgraphBlueprint(f).load()
        useWorkflowStore().attachWorkflow(bp)
        const nodeDef = convertToNodeDef(bp)

        subgraphDefCache.value.set(name, nodeDef)
        subgraphCache[name] = bp
      })
    )
  }
  function convertToNodeDef(workflow: LoadedComfyWorkflow): ComfyNodeDefImpl {
    const name = workflow.filename
    const subgraphNode = workflow.changeTracker.initialState.nodes[0]
    if (!subgraphNode) throw new Error('Invalid Subgraph Blueprint')
    const uuid = subgraphNode.type
    if (!uuid) throw new Error('')
    subgraphNode.inputs ??= []
    subgraphNode.outputs ??= []
    //NOTE: Types are cast to string. This is only used for input coloring on previews
    const inputs = Object.fromEntries(
      subgraphNode.inputs.map((i) => [
        i.name,
        ['' + i.type, undefined] satisfies InputSpec
      ])
    )
    const nodedefv1: ComfyNodeDefV1 = {
      input: { required: inputs },
      output: subgraphNode.outputs.map((o) => '' + o.type),
      output_name: subgraphNode.outputs.map((o) => o.name),
      name: typePrefix + name,
      display_name: name,
      description: 'User generated subgraph blueprint',
      category: 'Subgraph Blueprints',
      output_node: false,
      python_module: 'nodes'
    }
    const nodeDefImpl = new ComfyNodeDefImpl(nodedefv1)
    return nodeDefImpl
  }
  async function publishSubgraph() {
    const canvas = canvasStore.getCanvas()
    const graph = canvas.subgraph ?? canvas.graph
    if (!graph) throw new TypeError('Canvas has no graph or subgraph set.')
    const subgraphNode = [...canvas.selectedItems][0]
    if (
      canvas.selectedItems.size != 1 ||
      !(subgraphNode instanceof SubgraphNode)
    )
      throw new TypeError('Must have single SubgraphNode selected to publish')

    const { nodes = [], subgraphs = [] } = canvas._serializeItems([
      subgraphNode
    ])
    if (nodes.length != 1) {
      throw new TypeError('Must have single SubgraphNode selected to publish')
    }
    //create minimal workflow
    const workflowData = {
      revision: 0,
      last_node_id: subgraphNode.id,
      last_link_id: 0,
      nodes,
      links: [],
      version: 0.4,
      definitions: { subgraphs }
    }
    //prompt name
    const name = await dialogService.prompt({
      title: t('subgraphStore.saveBlueprint'),
      message: t('subgraphStore.blueprintName') + ':',
      defaultValue: subgraphNode.title
    })
    if (!name) return
    //check for duplicates
    if (subgraphDefCache.value.has(name))
      //insuficient. reconsider
      throw new Error('not implemented')
    //upload file
    const path = SubgraphBlueprint.basePath + name + '.json'
    const workflow = new SubgraphBlueprint({
      path,
      size: -1,
      modified: Date.now()
    })
    workflow.originalContent = JSON.stringify(workflowData)
    workflow.hasPromptedSave = true
    const loadedWorkflow = await workflow.load() //NOTE: Async, but not awaited
    await workflow.save()
    //add to files list?
    useWorkflowStore().attachWorkflow(loadedWorkflow)
    subgraphDefCache.value.set(name, convertToNodeDef(loadedWorkflow))
    //initiate refetch for simplicity
  }
  function updateDef(blueprint: LoadedComfyWorkflow) {
    subgraphDefCache.value.set(blueprint.filename, convertToNodeDef(blueprint))
  }
  function editBlueprint(nodeType: string) {
    const name = nodeType.slice(typePrefix.length)
    if (!(name in subgraphCache))
      //As loading is blocked on in startup, this can likely be changed to invalid type
      throw new Error('not yet loaded')
    useWorkflowStore().attachWorkflow(subgraphCache[name])
    void useWorkflowService().openWorkflow(subgraphCache[name])
  }
  function getBlueprint(nodeType: string): ComfyWorkflowJSON {
    const name = nodeType.slice(typePrefix.length)
    if (!(name in subgraphCache))
      //As loading is blocked on in startup, this can likely be changed to invalid type
      throw new Error('not yet loaded')
    return subgraphCache[name].changeTracker.initialState
  }
  function deleteBlueprint(nodeType: string) {
    const name = nodeType.slice(typePrefix.length)
    if (!(name in subgraphCache))
      //As loading is blocked on in startup, this can likely be changed to invalid type
      throw new Error('not yet loaded')
    void subgraphCache[name].delete()
    delete subgraphCache[name]
    subgraphDefCache.value.delete(name)
  }

  return {
    deleteBlueprint,
    editBlueprint,
    fetchSubgraphs,
    getBlueprint,
    publishSubgraph,
    subgraphBlueprints,
    updateDef
  }
})
