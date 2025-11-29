/**
 * Node Type Definitions
 */

export type NodeState = 'idle' | 'executing' | 'completed' | 'error' | 'bypassed' | 'muted'

export type SlotType =
  | 'MODEL'
  | 'CLIP'
  | 'VAE'
  | 'LATENT'
  | 'IMAGE'
  | 'CONDITIONING'
  | 'CONTROL_NET'
  | 'MASK'
  | 'INT'
  | 'FLOAT'
  | 'STRING'
  | 'BOOLEAN'
  | '*'

export type WidgetType = 'slider' | 'number' | 'text' | 'textarea' | 'select' | 'toggle' | 'color'

export interface SlotDefinition {
  name: string
  type: SlotType
  label?: string
  multi?: boolean
  hidden?: boolean
}

export interface WidgetOption {
  label: string
  value: string | number
}

export interface WidgetOptions {
  min?: number
  max?: number
  step?: number
  precision?: number
  choices?: WidgetOption[]
  placeholder?: string
  disabled?: boolean
}

export interface WidgetDefinition<T = unknown> {
  name: string
  type: WidgetType
  label?: string
  value: T
  options?: WidgetOptions
}

export interface NodeCategory {
  name: string
  color: string
}

export interface NodeDefinition {
  type: string
  displayName: string
  category: NodeCategory
  description?: string
  inputs: SlotDefinition[]
  outputs: SlotDefinition[]
  widgets: WidgetDefinition[]
  headerColor?: string
  bodyColor?: string
}

export interface NodeBadge {
  text: string
  icon?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
}

export interface NodeFlags {
  collapsed?: boolean
  minimized?: boolean
  pinned?: boolean
  resizable?: boolean
}

export interface FlowNodeData {
  definition: NodeDefinition
  widgetValues: Record<string, unknown>
  state: NodeState
  flags: NodeFlags
  title?: string
  progress?: number
  previewUrl?: string
  badges?: NodeBadge[]
  headerColor?: string
  bodyColor?: string
}

// Slot type colors
export const SLOT_COLORS: Record<SlotType, string> = {
  MODEL: '#b39ddb',
  CLIP: '#ffcc80',
  VAE: '#ef5350',
  LATENT: '#ff80ab',
  IMAGE: '#64b5f6',
  CONDITIONING: '#ffab40',
  CONTROL_NET: '#4dd0e1',
  MASK: '#81c784',
  INT: '#90a4ae',
  FLOAT: '#90a4ae',
  STRING: '#a5d6a7',
  BOOLEAN: '#ce93d8',
  '*': '#9e9e9e',
}

export function getSlotColor(type: SlotType): string {
  return SLOT_COLORS[type] || SLOT_COLORS['*']
}

// Node state colors
export const NODE_STATE_COLORS: Record<NodeState, string> = {
  idle: '#3f3f46',
  executing: '#3b82f6',
  completed: '#22c55e',
  error: '#ef4444',
  bypassed: '#f59e0b',
  muted: '#71717a',
}
