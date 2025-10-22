import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { t } from '@/i18n'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import type {
  ComfyNode,
  ComfyWorkflowJSON,
  NodeId
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeError } from '@/schemas/apiSchema'
import type {
  ComfyNodeDef as ComfyNodeDefV1,
  InputSpec
} from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import type { GlobalSubgraphData } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useExecutionStore } from '@/stores/executionStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { UserFile } from '@/stores/userFileStore'

async function confirmOverwrite(name: string): Promise<boolean | null> {
  return await useDialogService().confirm({
    title: t('subgraphStore.overwriteBlueprintTitle'),
    type: 'overwriteBlueprint',
    message: t('subgraphStore.overwriteBlueprint'),
    itemList: [name]
  })
}

export const useSubgraphStore = defineStore('subgraph', () => {
  class SubgraphBlueprint extends ComfyWorkflow {
    static override readonly basePath = 'subgraphs/'
    override readonly tintCanvasBg = '#22227740'

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
      //Instanceof doesn't function as nodes are serialized
      function isSubgraphNode(node: ComfyNode) {
        return node && subgraphs.some((s) => s.id === node.type)
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
    override async load({ force = false }: { force?: boolean } = {}): Promise<
      this & LoadedComfyWorkflow
    > {
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
    override unload(): void {
      //Skip unloading. Even if a workflow is closed after editing,
      //it must remain loaded in order to be added to the graph
    }
  }
  const subgraphCache: Record<string, LoadedComfyWorkflow> = {}
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
      options.path = SubgraphBlueprint.basePath + options.path
      const bp = await new SubgraphBlueprint(options, true).load()
      useWorkflowStore().attachWorkflow(bp)
      registerNodeDef(bp)
    }
    async function loadInstalledBlueprints() {
      async function loadGlobalBlueprint([k, v]: [string, GlobalSubgraphData]) {
        const path = SubgraphBlueprint.basePath + v.name + '.json'
        const blueprint = new SubgraphBlueprint({
          path,
          modified: Date.now(),
          size: -1
        })
        blueprint.originalContent = blueprint.content = await v.data
        blueprint.filename = v.name
        useWorkflowStore().attachWorkflow(blueprint)
        const loaded = await blueprint.load()
        registerNodeDef(
          loaded,
          {
            python_module: v.info.node_pack,
            display_name: v.name
          },
          k
        )
      }
      const subgraphs = await api.getGlobalSubgraphs()
      await Promise.allSettled(
        Object.entries(subgraphs).map(loadGlobalBlueprint)
      )
    }

    const userSubs = (
      await api.listUserDataFullInfo(SubgraphBlueprint.basePath)
    ).filter((f) => f.path.endsWith('.json'))
    const settled = await Promise.allSettled([
      ...userSubs.map(loadBlueprint),
      loadInstalledBlueprints()
    ])

    const errors = settled.filter((i) => 'reason' in i).map((i) => i.reason)
    errors.forEach((e) => console.error('Failed to load subgraph blueprint', e))
    if (errors.length > 0) {
      useToastStore().add({
        severity: 'error',
        summary: t('subgraphStore.loadFailure'),
        detail: errors.length > 3 ? `x${errors.length}` : `${errors}`,
        life: 6000
      })
    }
  }
  function registerNodeDef(
    workflow: LoadedComfyWorkflow,
    overrides: Partial<ComfyNodeDefV1> = {},
    name: string = workflow.filename
  ) {
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
      python_module: 'blueprint',
      ...overrides
    }
    const nodeDefImpl = new ComfyNodeDefImpl(nodedefv1)
    subgraphDefCache.value.set(name, nodeDefImpl)
    subgraphCache[name] = workflow
  }
  async function publishSubgraph() {
    const canvas = canvasStore.getCanvas()
    const subgraphNode = [...canvas.selectedItems][0]
    if (
      canvas.selectedItems.size !== 1 ||
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
    //Mark non-temporary
    workflow.size = 1
    await workflow.save()
    //add to files list?
    useWorkflowStore().attachWorkflow(loadedWorkflow)
    registerNodeDef(loadedWorkflow)
    useToastStore().add({
      severity: 'success',
      summary: t('subgraphStore.publishSuccess'),
      detail: t('subgraphStore.publishSuccessMessage'),
      life: 4000
    })
  }
  function updateDef(blueprint: LoadedComfyWorkflow) {
    registerNodeDef(blueprint)
  }
  async function editBlueprint(nodeType: string) {
    const name = nodeType.slice(typePrefix.length)
    if (!(name in subgraphCache))
      //As loading is blocked on in startup, this can likely be changed to invalid type
      throw new Error('not yet loaded')
    useWorkflowStore().attachWorkflow(subgraphCache[name])
    await useWorkflowService().openWorkflow(subgraphCache[name])
    const canvas = useCanvasStore().getCanvas()
    if (canvas.graph && 'subgraph' in canvas.graph.nodes[0])
      canvas.setGraph(canvas.graph.nodes[0].subgraph)
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
