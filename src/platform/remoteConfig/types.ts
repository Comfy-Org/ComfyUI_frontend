/**
 * Server health alert configuration from the backend
 */
type ServerHealthAlert = {
  message: string
  tooltip?: string
  severity?: 'info' | 'warning' | 'error'
  badge?: string
}

/**
 * Remote configuration type
 * Configuration fetched from the server at runtime
 */
export type RemoteConfig = {
  mixpanel_token?: string
  require_whitelist?: boolean
  subscription_required?: boolean
  server_health_alert?: ServerHealthAlert
}
