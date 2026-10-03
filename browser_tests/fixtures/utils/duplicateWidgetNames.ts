import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

import type { WorkflowJSON04 } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { WidgetValue } from '@/types/simplifiedWidget'

/**
 * Helpers for the node that carries two serializable widgets under one name.
 *
 * `ensureUniqueWidgetNames` normally renames the repeat to `name#1` before any
 * widget id is derived. It cannot rename a widget whose `name` is not
 * writable: it warns, gives up, and the node keeps the ambiguous pair — which
 * is the only state in which `widgets_values_named` loses a value.
 */

/** Two dict values, each with a key the other does not have. */
export const duplicateSavedValues: WidgetValue[] = [
  { trim: { start_time: 1, duration: 2 }, extension_only: { untouched: true } },
  { crop: { x: 1, y: 2, width: 3, height: 4 }, unknown_key: ['kept', 2] }
]

/**
 * Construction defaults, deliberately unlike any saved value.
 *
 * A widget constructed with the value a case then asserts would make that case
 * pass whether restore ran or not, so cases build from these and write what
 * they care about onto the live widgets first.
 */
const duplicateConstructionDefaults: WidgetValue[] = [
  'construction default a',
  'construction default b'
]

/**
 * Patches the node type so every instance gains two serializable widgets under
 * one name, the second of them unrenameable. Installed on the type rather than
 * on an instance so the reconstruction after a reload builds the same pair the
 * save was made from.
 */
export async function installUnrenameableDuplicatePair(
  comfyPage: ComfyPage,
  values: readonly WidgetValue[] = duplicateConstructionDefaults
): Promise<void> {
  await comfyPage.page.evaluate((widgetValues) => {
    const nodeType =
      window.LiteGraph!.registered_node_types['DevToolsNodeWithOutputList']
    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      onNodeCreated?.apply(this, args)
      this.serialize_widgets = true
      this.addWidget('custom', 'duplicate', widgetValues[0], () => {})
      const second = this.addWidget(
        'custom',
        'second',
        widgetValues[1],
        () => {}
      )
      Object.defineProperty(second, 'name', {
        value: 'duplicate',
        writable: false,
        configurable: false
      })
    }
  }, values)
}

/**
 * Replaces one node type's positional `widgets_values` in a saved document and
 * writes the result back to the store, so the next open reads the altered
 * register. Throws if the document carries no node of that type.
 */
export async function overwriteStoredWidgetValues(
  comfyPage: ComfyPage,
  workflowName: string,
  workflow: WorkflowJSON04,
  nodeType: string,
  values: readonly WidgetValue[]
): Promise<void> {
  const storedNode = workflow.nodes.find((node) => node.type === nodeType)
  if (!storedNode) {
    throw new Error(`Saved document is missing a ${nodeType} node`)
  }
  storedNode.widgets_values = [...values]
  await overwriteStoredWorkflow(comfyPage, workflowName, workflow)
}

/**
 * Overwrites a saved workflow in place, through the app's own userdata client
 * so the next open reads it back from the real store.
 */
async function overwriteStoredWorkflow(
  comfyPage: ComfyPage,
  workflowName: string,
  workflow: unknown
): Promise<void> {
  await comfyPage.page.evaluate(
    async ({ file, content }) => {
      await window.app!.api.storeUserData(file, content, {
        overwrite: true,
        stringify: true,
        throwOnError: true
      })
    },
    { file: `workflows/${workflowName}.json`, content: workflow }
  )
}

export async function writeWidgetValues(
  comfyPage: ComfyPage,
  nodeId: string,
  values: readonly WidgetValue[]
): Promise<void> {
  await comfyPage.page.evaluate(
    ({ id, widgetValues }) => {
      const node = window.app!.graph.nodes.find(
        ({ id: candidate }) => String(candidate) === id
      )!
      node.widgets!.forEach((widget, index) => {
        widget.value = widgetValues[index]
      })
    },
    { id: nodeId, widgetValues: values }
  )
}

export async function readWidgetValues(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<unknown[]> {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.nodes.find(
      ({ id: candidate }) => String(candidate) === id
    )!
    return node.widgets!.map((widget) => widget.value)
  }, nodeId)
}

export async function readWidgetNames(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<string[]> {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.nodes.find(
      ({ id: candidate }) => String(candidate) === id
    )!
    return node.widgets!.map((widget) => widget.name)
  }, nodeId)
}
