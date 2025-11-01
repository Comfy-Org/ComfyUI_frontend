/**
 * Mock TypeScript definitions representing v1.29.0 API surface
 * This represents the public API as it existed in version 1.29.0
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
   * Queue a prompt for execution
   */
  queuePrompt(prompt: object): Promise<{ prompt_id: string }>

  /**
   * Interrupt current execution
   */
  interrupt(): Promise<void>
}

export interface NodeDef {
  name: string
  category: string
  display_name?: string
  description?: string
  python_module: string
}

export enum NodeStatus {
  IDLE = 'idle',
  QUEUED = 'queued',
  RUNNING = 'running'
}

export interface WorkflowMetadata {
  title?: string
  description?: string
  author?: string
  version?: string
}

export class WorkflowManager {
  workflows: Map<string, object>

  constructor()

  loadWorkflow(id: string): Promise<object>
  saveWorkflow(id: string, data: object): Promise<void>
}

export type NodeId = string
