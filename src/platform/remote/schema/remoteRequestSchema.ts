type RemoteRequestClient = 'comfyApi'

export const DEFAULT_REMOTE_TIMEOUT_MS = 30_000
export const DEFAULT_REMOTE_MAX_RETRIES = 3

export interface RemoteRequestDescriptor {
  client: RemoteRequestClient
  route: string
  params?: Record<string, string>
  responseKey?: string
  ttl?: number
  timeout?: number
  maxRetries?: number
}

type RemoteAuthBucket = 'apikey' | 'anon'

export interface RemoteAuthScope {
  userId?: string | null
  workspaceId?: string | null
  apiKeyBucket?: RemoteAuthBucket | null
  apiKeySessionId?: number | null
}
