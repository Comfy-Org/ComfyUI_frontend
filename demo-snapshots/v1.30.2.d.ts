/**
 * Mock TypeScript definitions representing v1.30.2 API surface
 * This represents the public API with several breaking changes and additions
 */

export interface ComfyApi {
  /**
   * Get API URL for backend calls
   */
  apiURL(path: string): string

  /**
   * Get file URL for static resources
   */
  fileURL(path: string): string

  /**
   * Queue a prompt for execution (async version)
   */
  queuePromptAsync(
    prompt: object,
    options?: { priority?: number }
  ): Promise<{ prompt_id: string; number: number }>

  /**
   * Cancel a queued prompt
   */
  cancelPrompt(prompt_id: string): Promise<void>

  /**
   * Interrupt current execution
   */
  interrupt(): Promise<void>

  /**
   * Get queue status
   */
  getQueueStatus(): Promise<{ queue_running: any[]; queue_pending: any[] }>
}

export interface NodeDef {
  name: string
  category: string
  display_name?: string
  description?: string
  python_module: string
  input: {
    required?: Record<string, any>
    optional?: Record<string, any>
  }
  output: string[]
  output_name: string[]
}

export enum NodeStatus {
  IDLE = 'idle',
  QUEUED = 'queued',
  RUNNING = 'running',
  ERROR = 'error',
  COMPLETED = 'completed'
}

export interface WorkflowMetadata {
  title?: string
  description?: string
  author?: string
  version?: string
  tags?: string[]
  thumbnail?: string
}

export interface ExtensionMetadata {
  id: string
  name: string
  version: string
  description?: string
}

export class WorkflowManager {
  workflows: Map<string, object>
  cache: Map<string, object>

  constructor()

  loadWorkflow(id: string): Promise<object>
  saveWorkflow(id: string, data: object): Promise<void>
  deleteWorkflow(id: string): Promise<void>
  searchWorkflows(query: string): Promise<object[]>
}

export type NodeId = string
export type WorkflowId = string
