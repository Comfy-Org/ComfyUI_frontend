import type {
  PromptResponse as IngestPromptResponse,
  SystemStatsResponse,
  UserDataResponseFull
} from '@comfyorg/ingest-types'

export type PromptError = {
  type: string
  message: string
  details: string
}

export type NodeError = {
  errors: (PromptError & {
    extra_info?: { input_name?: string } & Record<string, unknown>
  })[]
  class_type: string
  dependent_outputs: unknown[]
}

export type PromptResponse = IngestPromptResponse & {
  node_errors?: Record<string, NodeError>
  exec_info?: { queue_remaining?: number }
}

export type PromptFailureResponse = {
  node_errors?: Record<string, NodeError>
  exec_info?: { queue_remaining?: number }
  error: string | NodeError['errors'][number]
}

export type DeviceStats = Required<SystemStatsResponse['devices'][number]> & {
  index: number
  torch_vram_total: number
  torch_vram_free: number
}

export type SystemStats = {
  devices: DeviceStats[]
  system: SystemStatsResponse['system'] & {
    required_frontend_version?: string
    installed_templates_version?: string
    required_templates_version?: string
    comfy_package_versions?: {
      name: string
      installed: string | null
      required: string | null
    }[]
  }
}

export type UserConfigResponse = {
  storage: 'server'
  migrated?: boolean
  users?: Record<string, string>
}

export type UserData = string[][]
export type UserDataFullInfo = Required<UserDataResponseFull>
