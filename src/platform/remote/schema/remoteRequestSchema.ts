export type RemoteRequestClient = 'comfyApi'

export interface RemoteRequestDescriptor {
  client: RemoteRequestClient
  route: string
  params?: Record<string, string>
  responseKey?: string
  ttl?: number
  timeout?: number
  maxRetries?: number
}

export type RemoteAuthBucket = 'apikey' | 'anon'

export interface RemoteAuthScope {
  userId?: string | null
  workspaceId?: string | null
  apiKeyBucket?: RemoteAuthBucket | null
}
