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
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { UserFile } from '@/stores/userFileStore'
import {
  ComfyWorkflow,
  LoadedComfyWorkflow,
  useWorkflowStore
} from '@/stores/workflowStore'

async function confirmOverwrite(name: string): Promise<boolean | null> {
  return await useDialogService().confirm({
    title: t('subgraphStore.overwriteBlueprintTitle'),
    type: 'overwriteBlueprint',
    message: t('subgraphStore.overwriteBlueprint'),
    itemList: [name]
  })
}

const subgraphCache: Record<string, LoadedComfyWorkflow> = {}

export const useSubgraphStore = defineStore('subgraph', () => {
  class SubgraphBlueprint extends ComfyWorkflow {
    static override readonly basePath = 'subgraphs/'

    hasPromptedSave: boolean = false

    constructor(
      options: { path: string; modified: number; size: number },
      confirmFirstSave: boolean = false
    ) {
      super(options)
      this.hasPromptedSave = !confirmFirstSave
    }

    validateSubgraph() {
      if (!this.activeState?.definitions)
        throw new Error(
          'The root graph of a subgraph blueprint must consist of only a single subgraph node'
        )
      const { subgraphs } = this.activeState.definitions
      const { nodes } = this.activeState
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
      if (
        !this.hasPromptedSave &&
        useSettingStore().get('Comfy.Workflow.WarnBlueprintOverwrite')
      ) {
        if (!(await confirmOverwrite(this.filename))) return this
        this.hasPromptedSave = true
      }
      const ret = await super.save()
      useSubgraphStore().updateDef(await this.load())
      return ret
    }

    override async saveAs(path: string) {
      this.validateSubgraph()
      this.hasPromptedSave = true
      const ret = await super.saveAs(path)
      useSubgraphStore().updateDef(await this.load())
      return ret
    }
    override async load({
      force = false
    }: { force?: boolean } = {}): Promise<LoadedComfyWorkflow> {
      if (!force && this.isLoaded) return await super.load({ force })
      const loaded = await super.load({ force })
      const st = loaded.activeState
      const sg = (st.definitions?.subgraphs ?? []).find(
        (sg) => sg.id == st.nodes[0].type
      )
      if (!sg)
        throw new Error(
          'Loaded subgraph blueprint does not contain valid subgraph'
        )
      sg.name = st.nodes[0].title = this.filename
      return loaded
    }
    override async promptSave(): Promise<string | null> {
      return await useDialogService().prompt({
        title: t('subgraphStore.saveBlueprint'),
        message: t('subgraphStore.blueprintName') + ':',
        defaultValue: this.filename
      })
    }
  }
  const typePrefix = 'SubgraphBlueprint.'
  const subgraphDefCache = ref<Map<string, ComfyNodeDefImpl>>(new Map())
  const canvasStore = useCanvasStore()
  const subgraphBlueprints = computed(() => [
    ...subgraphDefCache.value.values()
  ])
  async function fetchSubgraphs() {
    async function loadBlueprint(options: {
      path: string
      modified: number
      size: number
    }): Promise<void> {
      const name = options.path.slice(0, -'.json'.length)
      options.path = SubgraphBlueprint.basePath + options.path
      const bp = await new SubgraphBlueprint(options, true).load()
      useWorkflowStore().attachWorkflow(bp)
      const nodeDef = convertToNodeDef(bp)

      subgraphDefCache.value.set(name, nodeDef)
      subgraphCache[name] = bp
    }

    const res = (
      await api.listUserDataFullInfo(SubgraphBlueprint.basePath)
    ).filter((f) => f.path.endsWith('.json'))
    const settled = await Promise.allSettled(res.map(loadBlueprint))
    settled
      .filter((i) => 'reason' in i)
      .forEach(({ reason }) =>
        console.error('Failed to load subgraph blueprint', reason)
      )
  }
  function convertToNodeDef(workflow: LoadedComfyWorkflow): ComfyNodeDefImpl {
    const name = workflow.filename
    const subgraphNode = workflow.changeTracker.initialState.nodes[0]
    if (!subgraphNode) throw new Error('Invalid Subgraph Blueprint')
    subgraphNode.inputs ??= []
    subgraphNode.outputs ??= []
    //NOTE: Types are cast to string. This is only used for input coloring on previews
    const inputs = Object.fromEntries(
      subgraphNode.inputs.map((i) => [
        i.name,
        [`${i.type}`, undefined] satisfies InputSpec
      ])
    )
    let description = 'User generated subgraph blueprint'
    if (workflow.initialState.extra?.BlueprintDescription)
      description = `${workflow.initialState.extra.BlueprintDescription}`
    const nodedefv1: ComfyNodeDefV1 = {
      input: { required: inputs },
      output: subgraphNode.outputs.map((o) => `${o.type}`),
      output_name: subgraphNode.outputs.map((o) => o.name),
      name: typePrefix + name,
      display_name: name,
      description,
      category: 'Subgraph Blueprints',
      output_node: false,
      python_module: 'nodes'
    }
    const nodeDefImpl = new ComfyNodeDefImpl(nodedefv1)
    return nodeDefImpl
  }
  async function publishSubgraph() {
    const canvas = canvasStore.getCanvas()
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
    const name = await useDialogService().prompt({
      title: t('subgraphStore.saveBlueprint'),
      message: t('subgraphStore.blueprintName') + ':',
      defaultValue: subgraphNode.title
    })
    if (!name) return
    if (subgraphDefCache.value.has(name) && !(await confirmOverwrite(name)))
      //User has chosen not to overwrite.
      return

    //upload file
    const path = SubgraphBlueprint.basePath + name + '.json'
    const workflow = new SubgraphBlueprint({
      path,
      size: -1,
      modified: Date.now()
    })
    workflow.originalContent = JSON.stringify(workflowData)
    const loadedWorkflow = await workflow.load()
    await workflow.save()
    //add to files list?
    useWorkflowStore().attachWorkflow(loadedWorkflow)
    subgraphDefCache.value.set(name, convertToNodeDef(loadedWorkflow))
    subgraphCache[name] = loadedWorkflow
    useToastStore().add({
      severity: 'success',
      summary: t('subgraphStore.publishSuccess'),
      detail: t('subgraphStore.publishSuccessMessage'),
      life: 4000
    })
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
    void useWorkflowService()
      .openWorkflow(subgraphCache[name])
      .then(() => {
        const canvas = useCanvasStore().getCanvas()
        if (canvas.graph && 'subgraph' in canvas.graph.nodes[0])
          canvas.setGraph(canvas.graph.nodes[0].subgraph)
      })
  }
  function getBlueprint(nodeType: string): ComfyWorkflowJSON {
    const name = nodeType.slice(typePrefix.length)
    if (!(name in subgraphCache))
      //As loading is blocked on in startup, this can likely be changed to invalid type
      throw new Error('not yet loaded')
    return subgraphCache[name].changeTracker.initialState
  }
  async function deleteBlueprint(nodeType: string) {
    const name = nodeType.slice(typePrefix.length)
    if (!(name in subgraphCache))
      //As loading is blocked on in startup, this can likely be changed to invalid type
      throw new Error('not yet loaded')
    if (
      !(await useDialogService().confirm({
        title: t('subgraphStore.confirmDeleteTitle'),
        type: 'delete',
        message: t('subgraphStore.confirmDelete'),
        itemList: [name]
      }))
    )
      return

    await subgraphCache[name].delete()
    delete subgraphCache[name]
    subgraphDefCache.value.delete(name)
  }
  function isSubgraphBlueprint(
    workflow: unknown
  ): workflow is SubgraphBlueprint {
    return workflow instanceof SubgraphBlueprint
  }

  return {
    deleteBlueprint,
    editBlueprint,
    fetchSubgraphs,
    getBlueprint,
    isSubgraphBlueprint,
    publishSubgraph,
    subgraphBlueprints,
    typePrefix,
    updateDef
  }
})
