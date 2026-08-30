import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useLitegraphService } from '@/services/litegraphService'
import { useDialogStore } from '@/stores/dialogStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import CustomNodeCreateDialogContent from '../components/CustomNodeCreateDialogContent.vue'
import type { CustomNodeCreateRequest } from '../components/CustomNodeCreateDialogContent.vue'
import { nodeClassNameFor } from '../utils/nodeNaming'
import {
  packKeyFromPythonModule,
  packKeyFromRevisionId
} from '../utils/packIdentity'
import {
  CustomNodeEditorRequestError,
  useCustomNodeEditor
} from './useCustomNodeEditor'
import { useCustomNodeEditorDialog } from './useCustomNodeEditorDialog'
import type { UploadedNodePack } from './useCustomNodePacks'
import { useCustomNodePacks } from './useCustomNodePacks'

const CREATE_DIALOG_KEY = 'custom-node-create'
/** How long to wait for a submitted pack's node to reach the node library. */
const NODE_REGISTRATION_TIMEOUT_MS = 90_000
const NODE_REGISTRATION_INTERVAL_MS = 2_000

/** A pack name that does not collide with the workspace's existing packs. */
function availablePackName(packs: readonly UploadedNodePack[]): string {
  const base = t('customNodePacks.createDialog.defaultPackName')
  const taken = new Set(packs.map((pack) => pack.name.trim().toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} (${suffix})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

/**
 * A node name that does not collide with the nodes the target pack already
 * registers. Collisions are judged on the generated class name, which is what
 * the manager enforces uniqueness on.
 */
function takenNodeClassNames(targetPack?: UploadedNodePack): string[] {
  if (!targetPack) return []
  const packKey = packKeyFromRevisionId(targetPack.revisionId)
  return Object.values(useNodeDefStore().nodeDefsByName)
    .filter((def) => packKeyFromPythonModule(def.python_module) === packKey)
    .map((def) => def.name)
}

function availableNodeName(targetPack?: UploadedNodePack): string {
  const base = t('customNodePacks.createDialog.defaultNodeName')
  if (!targetPack) return base
  const taken = new Set(takenNodeClassNames(targetPack))
  if (!taken.has(nodeClassNameFor(base))) return base
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} (${suffix})`
    if (!taken.has(nodeClassNameFor(candidate))) return candidate
  }
}

/**
 * Asks for the pack/node names (and an optional first instruction), then opens
 * the editor on the newly scaffolded node. Shared by the canvas menu and the
 * Custom Nodes panel so both entry points behave identically.
 */
export function useCustomNodeCreateFlow() {
  const dialogStore = useDialogStore()
  const { createSession, refreshNodeDefinitions } = useCustomNodeEditor()
  const editorDialog = useCustomNodeEditorDialog()
  const packsApi = useCustomNodePacks()

  const askForNames = (options: {
    targetPackName?: string
    defaultPackName: string
    defaultNodeName: string
    existingPackNames: string[]
    existingNodeClassNames: string[]
  }): Promise<CustomNodeCreateRequest | null> =>
    new Promise<CustomNodeCreateRequest | null>((resolve) => {
      dialogStore.showDialog({
        key: CREATE_DIALOG_KEY,
        title: options.targetPackName
          ? t('customNodePacks.createDialog.titleExisting')
          : t('customNodePacks.createDialog.title'),
        component: CustomNodeCreateDialogContent,
        props: {
          targetPackName: options.targetPackName,
          defaultPackName: options.defaultPackName,
          defaultNodeName: options.defaultNodeName,
          existingPackNames: options.existingPackNames,
          existingNodeClassNames: options.existingNodeClassNames,
          onSubmit: (request: CustomNodeCreateRequest) => resolve(request),
          onCancel: () => resolve(null)
        },
        dialogComponentProps: {
          renderer: 'reka',
          size: 'md',
          closable: true,
          onClose: () => resolve(null)
        }
      })
    }).then((result) => {
      dialogStore.closeDialog({ key: CREATE_DIALOG_KEY })
      return result
    })

  /**
   * Drops the freshly created node onto the graph, ready to wire up.
   *
   * Submitting a pack returns as soon as the manager stores it, but the
   * runtime needs a few seconds more to install it and publish its node
   * definition. A single refresh at submit time therefore races the install
   * and loses: the node is neither placed nor searchable until the page is
   * reloaded. Keep refreshing until the definition actually shows up.
   */
  const addCreatedNodeToGraph = async (sessionId: string, nodeName: string) => {
    const nodeId = nodeClassNameFor(nodeName)
    const nodeDefStore = useNodeDefStore()
    const deadline = Date.now() + NODE_REGISTRATION_TIMEOUT_MS
    for (;;) {
      const definition = nodeDefStore.nodeDefsByName[nodeId]
      if (definition) {
        useLitegraphService().addNodeOnGraph(definition)
        return
      }
      if (Date.now() >= deadline) {
        useToastStore().add({
          severity: 'warn',
          summary: t('customNodePacks.createDialog.nodeNotReady'),
          detail: t('customNodePacks.createDialog.nodeNotReadyDetail', {
            name: nodeName
          }),
          life: 8000
        })
        return
      }
      await new Promise((resolve) =>
        setTimeout(resolve, NODE_REGISTRATION_INTERVAL_MS)
      )
      // Refreshes the ingest-side catalog too, not just this tab's cache.
      await refreshNodeDefinitions(sessionId).catch(() => undefined)
    }
  }

  /**
   * @param targetPack the pack to add the node to; omit to create a new pack.
   */
  const startCreateFlow = async (targetPack?: UploadedNodePack) => {
    await packsApi.refresh().catch(() => undefined)
    const packs = packsApi.packs.value
    let defaultPackName = availablePackName(packs)
    let defaultNodeName = availableNodeName(targetPack)

    // A name the server rejects (for example one already used inside the
    // pack) reopens the dialog with the entered values, rather than
    // dropping the user back to the graph.
    for (;;) {
      const request = await askForNames({
        targetPackName: targetPack?.name,
        defaultPackName,
        defaultNodeName,
        existingPackNames: packs.map((pack) => pack.name),
        existingNodeClassNames: takenNodeClassNames(targetPack)
      })
      if (!request) return

      try {
        const session = await createSession({
          mode: targetPack ? 'edit' : 'create',
          name: request.packName,
          revisionId: targetPack?.revisionId,
          nodeName: request.nodeName
        })
        editorDialog.show(
          session,
          async () => {
            await packsApi.refresh().catch(() => undefined)
            await addCreatedNodeToGraph(session.id, request.nodeName)
          },
          { initialPrompt: request.prompt }
        )
        return
      } catch (error) {
        const conflict =
          error instanceof CustomNodeEditorRequestError && error.status === 409
        if (!conflict) {
          reportError(error, { errorType: 'custom_node_editor_start_failed' })
        }
        useToastStore().add({
          severity: conflict ? 'warn' : 'error',
          summary: t('customNodePacks.editor.openFailed'),
          detail: error instanceof Error ? error.message : String(error),
          life: 8000
        })
        if (!conflict) return
        defaultPackName = request.packName
        defaultNodeName = request.nodeName
      }
    }
  }

  return { startCreateFlow, addCreatedNodeToGraph, availablePackName }
}
