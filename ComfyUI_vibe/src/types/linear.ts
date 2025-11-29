/**
 * Linear Mode Type Definitions
 *
 * Linear Mode is a simplified Runway/Midjourney-style interface
 * that presents complex ComfyUI workflows as simple step-by-step flows.
 */

import type { NodeDefinition, WidgetDefinition, NodeState } from './node'

/**
 * A step in a linear workflow - represents a node in simplified form
 */
export interface LinearStep {
  id: string
  nodeType: string
  displayName: string
  description?: string
  icon?: string
  category: 'input' | 'process' | 'output'
  state: NodeState
  progress?: number

  // Which widgets to expose to the user (simplified subset)
  exposedWidgets: string[]

  // Current widget values
  widgetValues: Record<string, unknown>

  // Original node definition for reference
  definition: NodeDefinition

  // Preview image URL (for output nodes)
  previewUrl?: string
}

/**
 * A linear workflow template - a pre-configured workflow
 */
export interface LinearWorkflowTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: LinearTemplateCategory
  tags: string[]

  // The steps in order
  steps: LinearStepTemplate[]

  // Thumbnail preview
  thumbnailUrl?: string

  // Is this a featured/official template?
  featured?: boolean
}

/**
 * Template for a step - defines what node to use and default config
 */
export interface LinearStepTemplate {
  id: string
  nodeType: string
  displayName: string
  description?: string
  icon?: string

  // Which widgets to expose (by name)
  exposedWidgets: string[]

  // Default values for widgets
  defaultValues?: Record<string, unknown>

  // Widget overrides (labels, options, etc.)
  widgetOverrides?: Record<string, Partial<WidgetDefinition>>
}

/**
 * Categories for workflow templates
 */
export type LinearTemplateCategory =
  | 'text-to-image'
  | 'image-to-image'
  | 'inpainting'
  | 'upscaling'
  | 'video'
  | 'audio'
  | 'custom'

/**
 * Execution state for linear workflow
 */
export type LinearExecutionState =
  | 'idle'
  | 'queued'
  | 'running'
  | 'completed'
  | 'error'
  | 'cancelled'

/**
 * A running linear workflow instance
 */
export interface LinearWorkflowInstance {
  id: string
  templateId: string
  templateName: string

  // Current execution state
  executionState: LinearExecutionState

  // Which step is currently executing (0-indexed)
  currentStepIndex: number

  // The actual steps with current values
  steps: LinearStep[]

  // Generated outputs
  outputs: LinearOutput[]

  // Error message if failed
  errorMessage?: string

  // Timestamps
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

/**
 * An output from a linear workflow
 */
export interface LinearOutput {
  id: string
  type: 'image' | 'video' | 'audio' | 'text' | 'file'
  url: string
  thumbnailUrl?: string
  filename: string
  createdAt: Date

  // Metadata about the generation
  metadata?: {
    prompt?: string
    negativePrompt?: string
    seed?: number
    steps?: number
    cfg?: number
    sampler?: string
    model?: string
    width?: number
    height?: number
  }
}

/**
 * History entry for linear mode
 */
export interface LinearHistoryEntry {
  id: string
  workflowInstance: LinearWorkflowInstance
  outputs: LinearOutput[]
  createdAt: Date
}

/**
 * View modes for linear mode
 */
export type LinearViewMode = 'create' | 'gallery' | 'history'

/**
 * Panel states for the UI
 */
export interface LinearPanelState {
  templateSelectorOpen: boolean
  parametersPanelOpen: boolean
  historyPanelOpen: boolean
}
