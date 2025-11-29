/**
 * Linear Mode Store
 *
 * Manages state for the simplified Runway/Midjourney-style workflow interface.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  LinearWorkflowTemplate,
  LinearWorkflowInstance,
  LinearStep,
  LinearOutput,
  LinearExecutionState,
  LinearViewMode,
  LinearHistoryEntry,
} from '@/types/linear'
import { LINEAR_WORKFLOW_TEMPLATES } from '@/data/linearTemplates'
import { NODE_DEFINITIONS } from '@/data/nodeDefinitions'

export const useLinearModeStore = defineStore('linearMode', () => {
  // ===== State =====

  // Current view mode
  const viewMode = ref<LinearViewMode>('create')

  // Available templates
  const templates = ref<LinearWorkflowTemplate[]>(LINEAR_WORKFLOW_TEMPLATES)

  // Selected template
  const selectedTemplate = ref<LinearWorkflowTemplate | null>(null)

  // Current workflow instance
  const currentWorkflow = ref<LinearWorkflowInstance | null>(null)

  // Generated outputs gallery
  const outputs = ref<LinearOutput[]>([])

  // History of completed workflows
  const history = ref<LinearHistoryEntry[]>([])

  // UI State
  const isGenerating = ref(false)
  const showTemplateSelector = ref(true)

  // ===== Getters =====

  const featuredTemplates = computed(() =>
    templates.value.filter((t) => t.featured)
  )

  const templatesByCategory = computed(() => {
    const grouped: Record<string, LinearWorkflowTemplate[]> = {}
    for (const template of templates.value) {
      if (!grouped[template.category]) {
        grouped[template.category] = []
      }
      grouped[template.category].push(template)
    }
    return grouped
  })

  const currentSteps = computed(() => currentWorkflow.value?.steps ?? [])

  const currentStepIndex = computed(
    () => currentWorkflow.value?.currentStepIndex ?? 0
  )

  const executionProgress = computed(() => {
    if (!currentWorkflow.value) return 0
    const { steps, currentStepIndex } = currentWorkflow.value
    if (steps.length === 0) return 0

    // Calculate progress based on completed steps
    const completedSteps = steps.filter((s) => s.state === 'completed').length
    const currentProgress = steps[currentStepIndex]?.progress ?? 0

    return ((completedSteps + currentProgress / 100) / steps.length) * 100
  })

  const canGenerate = computed(() => {
    return currentWorkflow.value !== null && !isGenerating.value
  })

  // ===== Actions =====

  /**
   * Select a template and create a new workflow instance
   */
  function selectTemplate(template: LinearWorkflowTemplate): void {
    selectedTemplate.value = template
    showTemplateSelector.value = false

    // Create workflow instance from template
    const steps: LinearStep[] = template.steps.map((stepTemplate, index) => {
      const nodeDef = NODE_DEFINITIONS[stepTemplate.nodeType]
      if (!nodeDef) {
        console.warn(`Node definition not found: ${stepTemplate.nodeType}`)
      }

      // Determine category based on step position
      let category: 'input' | 'process' | 'output' = 'process'
      if (index === 0) category = 'input'
      else if (index === template.steps.length - 1) category = 'output'

      // Build widget values from defaults
      const widgetValues: Record<string, unknown> = {}
      if (nodeDef) {
        for (const widget of nodeDef.widgets) {
          widgetValues[widget.name] =
            stepTemplate.defaultValues?.[widget.name] ?? widget.value
        }
      }

      return {
        id: `step-${index}-${Date.now()}`,
        nodeType: stepTemplate.nodeType,
        displayName: stepTemplate.displayName,
        description: stepTemplate.description,
        icon: stepTemplate.icon,
        category,
        state: 'idle',
        exposedWidgets: stepTemplate.exposedWidgets,
        widgetValues,
        definition: nodeDef ?? createPlaceholderDefinition(stepTemplate.nodeType),
      }
    })

    currentWorkflow.value = {
      id: `workflow-${Date.now()}`,
      templateId: template.id,
      templateName: template.name,
      executionState: 'idle',
      currentStepIndex: 0,
      steps,
      outputs: [],
      createdAt: new Date(),
    }
  }

  /**
   * Update a widget value for a step
   */
  function updateStepWidget(
    stepId: string,
    widgetName: string,
    value: unknown
  ): void {
    if (!currentWorkflow.value) return

    const step = currentWorkflow.value.steps.find((s) => s.id === stepId)
    if (step) {
      step.widgetValues[widgetName] = value
    }
  }

  /**
   * Start generating (mock implementation)
   */
  async function startGeneration(): Promise<void> {
    if (!currentWorkflow.value) return

    isGenerating.value = true
    currentWorkflow.value.executionState = 'running'
    currentWorkflow.value.startedAt = new Date()

    // Simulate step-by-step execution
    for (let i = 0; i < currentWorkflow.value.steps.length; i++) {
      currentWorkflow.value.currentStepIndex = i
      const step = currentWorkflow.value.steps[i]

      step.state = 'executing'

      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 10) {
        step.progress = progress
        await sleep(100)
      }

      step.state = 'completed'
      step.progress = 100
    }

    // Add mock output
    const mockOutput: LinearOutput = {
      id: `output-${Date.now()}`,
      type: 'image',
      url: 'https://picsum.photos/seed/' + Date.now() + '/512/512',
      thumbnailUrl: 'https://picsum.photos/seed/' + Date.now() + '/256/256',
      filename: `generation_${Date.now()}.png`,
      createdAt: new Date(),
      metadata: extractMetadata(currentWorkflow.value),
    }

    currentWorkflow.value.outputs.push(mockOutput)
    outputs.value.unshift(mockOutput)

    currentWorkflow.value.executionState = 'completed'
    currentWorkflow.value.completedAt = new Date()

    // Add to history
    history.value.unshift({
      id: `history-${Date.now()}`,
      workflowInstance: { ...currentWorkflow.value },
      outputs: [...currentWorkflow.value.outputs],
      createdAt: new Date(),
    })

    isGenerating.value = false
  }

  /**
   * Cancel generation
   */
  function cancelGeneration(): void {
    if (!currentWorkflow.value || !isGenerating.value) return

    isGenerating.value = false
    currentWorkflow.value.executionState = 'cancelled'

    // Mark current step as idle
    const currentStep =
      currentWorkflow.value.steps[currentWorkflow.value.currentStepIndex]
    if (currentStep) {
      currentStep.state = 'idle'
      currentStep.progress = 0
    }
  }

  /**
   * Reset current workflow to initial state
   */
  function resetWorkflow(): void {
    if (!currentWorkflow.value) return

    currentWorkflow.value.executionState = 'idle'
    currentWorkflow.value.currentStepIndex = 0
    currentWorkflow.value.outputs = []
    currentWorkflow.value.startedAt = undefined
    currentWorkflow.value.completedAt = undefined

    for (const step of currentWorkflow.value.steps) {
      step.state = 'idle'
      step.progress = 0
    }
  }

  /**
   * Go back to template selection
   */
  function showTemplates(): void {
    showTemplateSelector.value = true
    selectedTemplate.value = null
    currentWorkflow.value = null
  }

  /**
   * Set view mode
   */
  function setViewMode(mode: LinearViewMode): void {
    viewMode.value = mode
  }

  /**
   * Delete an output from gallery
   */
  function deleteOutput(outputId: string): void {
    const index = outputs.value.findIndex((o) => o.id === outputId)
    if (index !== -1) {
      outputs.value.splice(index, 1)
    }
  }

  /**
   * Clear all outputs
   */
  function clearOutputs(): void {
    outputs.value = []
  }

  return {
    // State
    viewMode,
    templates,
    selectedTemplate,
    currentWorkflow,
    outputs,
    history,
    isGenerating,
    showTemplateSelector,

    // Getters
    featuredTemplates,
    templatesByCategory,
    currentSteps,
    currentStepIndex,
    executionProgress,
    canGenerate,

    // Actions
    selectTemplate,
    updateStepWidget,
    startGeneration,
    cancelGeneration,
    resetWorkflow,
    showTemplates,
    setViewMode,
    deleteOutput,
    clearOutputs,
  }
})

// ===== Helpers =====

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createPlaceholderDefinition(nodeType: string) {
  return {
    type: nodeType,
    displayName: nodeType,
    category: { name: 'unknown', color: '#888' },
    inputs: [],
    outputs: [],
    widgets: [],
  }
}

function extractMetadata(
  workflow: LinearWorkflowInstance
): LinearOutput['metadata'] {
  const metadata: LinearOutput['metadata'] = {}

  for (const step of workflow.steps) {
    const values = step.widgetValues

    if (values.text) metadata.prompt = String(values.text)
    if (values.seed) metadata.seed = Number(values.seed)
    if (values.steps) metadata.steps = Number(values.steps)
    if (values.cfg) metadata.cfg = Number(values.cfg)
    if (values.sampler_name) metadata.sampler = String(values.sampler_name)
    if (values.ckpt_name) metadata.model = String(values.ckpt_name)
    if (values.width) metadata.width = Number(values.width)
    if (values.height) metadata.height = Number(values.height)
  }

  return metadata
}
