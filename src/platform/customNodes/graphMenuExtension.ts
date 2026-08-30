import { t } from '@/i18n'
import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { useCustomNodeEditor } from './composables/useCustomNodeEditor'
import { useCustomNodeEditorDialog } from './composables/useCustomNodeEditorDialog'
import type { UploadedNodePack } from './composables/useCustomNodePacks'
import { useCustomNodePacks } from './composables/useCustomNodePacks'
import { findOwnedPackForModule } from './utils/packIdentity'

let isStartingEditor = false

async function openEditorSession(
  mode: 'create' | 'edit',
  name: string,
  revisionId?: string
) {
  if (isStartingEditor) return
  isStartingEditor = true
  const { createSession } = useCustomNodeEditor()
  const { refresh } = useCustomNodePacks()
  try {
    const session = await createSession({ mode, name, revisionId })
    useCustomNodeEditorDialog().show(session, refresh)
  } catch (error) {
    reportError(error, { errorType: 'custom_node_editor_start_failed' })
    useToastStore().add({
      severity: 'error',
      summary: t('customNodePacks.editor.openFailed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 8000
    })
  } finally {
    isStartingEditor = false
  }
}

function availableStarterName(packs: readonly UploadedNodePack[]): string {
  const baseName = t('customNodePacks.editor.starterName')
  const existingNames = new Set(packs.map((pack) => pack.name))
  if (!existingNames.has(baseName)) return baseName
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${baseName} ${suffix}`
    if (!existingNames.has(candidate)) return candidate
  }
}

async function createNodeInNewPack() {
  const { packs, refresh } = useCustomNodePacks()
  await refresh().catch(() => undefined)
  await openEditorSession('create', availableStarterName(packs.value))
}

/** Menu builders exported for tests; menus must be assembled synchronously. */
export function customNodeCanvasMenuItems(): IContextMenuValue[] {
  const { packs, refresh } = useCustomNodePacks()
  // Stale-while-revalidate: build from the cached list now, refresh for the
  // next menu open in the background.
  void refresh().catch(() => undefined)
  const newPackItem: IContextMenuValue = {
    content: t('customNodePacks.graphMenu.inNewPack'),
    callback: () => {
      void createNodeInNewPack()
    }
  }
  if (packs.value.length === 0) {
    return [
      {
        content: t('customNodePacks.graphMenu.createNode'),
        beforePaste: true,
        callback: newPackItem.callback
      }
    ]
  }
  return [
    {
      content: t('customNodePacks.graphMenu.createNode'),
      beforePaste: true,
      has_submenu: true,
      submenu: {
        options: [
          newPackItem,
          ...packs.value.map(
            (pack): IContextMenuValue => ({
              content: t('customNodePacks.graphMenu.inPack', {
                name: pack.name
              }),
              callback: () => {
                void openEditorSession('edit', pack.name, pack.revisionId)
              }
            })
          )
        ]
      }
    }
  ]
}

export function customNodeNodeMenuItems(node: LGraphNode): IContextMenuValue[] {
  const definition = useNodeDefStore().fromLGraphNode(node)
  const { packs, refresh } = useCustomNodePacks()
  // Stale-while-revalidate: decide from the cached list now, refresh for the
  // next menu open in the background.
  void refresh().catch(() => undefined)
  const pack = findOwnedPackForModule(definition?.python_module, packs.value)
  if (!pack) return []
  return [
    {
      content: t('customNodePacks.graphMenu.editNode'),
      callback: () => {
        void openEditorSession('edit', pack.name, pack.revisionId)
      }
    }
  ]
}

app.registerExtension({
  name: 'Comfy.CustomNodePacks.GraphMenu',
  setup() {
    // Warm the pack cache so the first right-click can already decide
    // whether a node is one of the workspace's own.
    void useCustomNodePacks()
      .refresh()
      .catch(() => undefined)
  },
  getCanvasMenuItems: () => customNodeCanvasMenuItems(),
  getNodeMenuItems: (node) => customNodeNodeMenuItems(node)
})
