import axios from 'axios'

import type { AxiosInstance } from 'axios'

// Types matching ComfyUI backend API
export interface SystemStats {
  system: {
    os: string
    python_version: string
    embedded_python: boolean
  }
  devices: DeviceInfo[]
}

export interface DeviceInfo {
  name: string
  type: string
  index: number
  vram_total: number
  vram_free: number
  torch_vram_total: number
  torch_vram_free: number
}

export interface NodeDef {
  input: {
    required?: Record<string, unknown>
    optional?: Record<string, unknown>
  }
  output: string[]
  output_is_list: boolean[]
  output_name: string[]
  name: string
  display_name: string
  description: string
  category: string
}

export interface QueueInfo {
  queue_running: Array<[number, string, unknown]>
  queue_pending: Array<[number, string, unknown]>
}

export interface PromptResponse {
  prompt_id: string
  number: number
  node_errors: Record<string, unknown>
}

class ComfyApi {
  private client: AxiosInstance

  constructor(baseUrl = '/api') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  // System endpoints
  async getSystemStats(): Promise<SystemStats> {
    const response = await this.client.get<SystemStats>('/system_stats')
    return response.data
  }

  // Node definitions
  async getNodeDefs(): Promise<Record<string, NodeDef>> {
    const response = await this.client.get<Record<string, NodeDef>>(
      '/object_info'
    )
    return response.data
  }

  // Queue management
  async getQueue(): Promise<QueueInfo> {
    const response = await this.client.get<QueueInfo>('/queue')
    return response.data
  }

  async queuePrompt(prompt: unknown, clientId?: string): Promise<PromptResponse> {
    const response = await this.client.post<PromptResponse>('/prompt', {
      prompt,
      client_id: clientId
    })
    return response.data
  }

  async deleteFromQueue(deleteId: string): Promise<void> {
    await this.client.post('/queue', { delete: [deleteId] })
  }

  async clearQueue(): Promise<void> {
    await this.client.post('/queue', { clear: true })
  }

  async interrupt(): Promise<void> {
    await this.client.post('/interrupt')
  }

  // History
  async getHistory(maxItems = 200): Promise<Record<string, unknown>> {
    const response = await this.client.get(`/history?max_items=${maxItems}`)
    return response.data
  }

  async deleteHistory(promptId: string): Promise<void> {
    await this.client.post('/history', { delete: [promptId] })
  }

  async clearHistory(): Promise<void> {
    await this.client.post('/history', { clear: true })
  }

  // File uploads
  async uploadImage(
    file: File,
    subfolder = '',
    overwrite = false
  ): Promise<{ name: string; subfolder: string; type: string }> {
    const formData = new FormData()
    formData.append('image', file)
    if (subfolder) formData.append('subfolder', subfolder)
    formData.append('overwrite', String(overwrite))

    const response = await this.client.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  }

  // View outputs
  getImageUrl(
    filename: string,
    subfolder = '',
    type = 'output'
  ): string {
    const params = new URLSearchParams({
      filename,
      subfolder,
      type
    })
    return `/api/view?${params.toString()}`
  }
}

export const comfyApi = new ComfyApi()
