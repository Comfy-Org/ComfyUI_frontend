import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useLinearModeStore } from './stores/linearModeStore'
import type {
  ComfyNode,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { PromotedWidget } from './linearModeTypes'

export async function loadTemplate(
  templatePath: string
): Promise<ComfyWorkflowJSON> {
  const response = await fetch(api.fileURL(templatePath))
  if (!response.ok) {
    throw new Error(`Failed to load template: ${response.statusText}`)
  }
  return await response.json()
}

export function getWidgetValue(
  workflow: ComfyWorkflowJSON,
  nodeId: number,
  widgetName: string
): unknown {
  const nodeIdStr = String(nodeId)
  const node = workflow.nodes?.find(
    (n: ComfyNode) => String(n.id) === nodeIdStr
  )
  if (!node) return undefined

  if (!node.widgets_values) return undefined
  if (Array.isArray(node.widgets_values)) return undefined

  return node.widgets_values[widgetName]
}

export function setWidgetValue(
  workflow: ComfyWorkflowJSON,
  nodeId: number,
  widgetName: string,
  value: unknown
): boolean {
  const nodeIdStr = String(nodeId)
  const node = workflow.nodes?.find(
    (n: ComfyNode) => String(n.id) === nodeIdStr
  )
  if (!node) return false

  if (!node.widgets_values) {
    node.widgets_values = {}
  }

  if (Array.isArray(node.widgets_values)) {
    return false
  }

  node.widgets_values[widgetName] = value
  return true
}

export function getAllWidgetValues(): Map<string, unknown> {
  const linearModeStore = useLinearModeStore()
  const workflowStore = useWorkflowStore()

  const values = new Map<string, unknown>()
  const workflow = workflowStore.activeWorkflow?.activeState

  if (!workflow) return values

  for (const widget of linearModeStore.promotedWidgets) {
    const value = getWidgetValue(workflow, widget.nodeId, widget.widgetName)
    values.set(widget.displayName, value)
  }

  return values
}

export function updateWidgetValue(
  widget: PromotedWidget,
  value: unknown
): boolean {
  const workflowStore = useWorkflowStore()
  const workflow = workflowStore.activeWorkflow?.activeState

  if (!workflow) return false

  return setWidgetValue(workflow, widget.nodeId, widget.widgetName, value)
}

export async function activateTemplate(templateId: string): Promise<void> {
  const linearModeStore = useLinearModeStore()
  const template = linearModeStore.template

  if (!template || template.id !== templateId) {
    throw new Error(`Template not found: ${templateId}`)
  }

  const workflow = await loadTemplate(template.templatePath)

  await app.loadGraphData(workflow)
}

export async function initializeLinearMode(templateId: string): Promise<void> {
  const linearModeStore = useLinearModeStore()

  linearModeStore.open(templateId)
  await activateTemplate(templateId)
}
