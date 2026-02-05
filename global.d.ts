declare const __COMFYUI_FRONTEND_VERSION__: string
declare const __SENTRY_ENABLED__: boolean
declare const __SENTRY_DSN__: string
declare const __ALGOLIA_APP_ID__: string
declare const __ALGOLIA_API_KEY__: string
declare const __USE_PROD_CONFIG__: boolean

interface Window {
  __CONFIG__: {
    gtm_container_id?: string
    mixpanel_token?: string
    require_whitelist?: boolean
    subscription_required?: boolean
    max_upload_size?: number
    comfy_api_base_url?: string
    comfy_platform_base_url?: string
    firebase_config?: {
      apiKey: string
      authDomain: string
      databaseURL?: string
      projectId: string
      storageBucket: string
      messagingSenderId: string
      appId: string
      measurementId?: string
    }
    server_health_alert?: {
      message: string
      tooltip?: string
      severity?: 'info' | 'warning' | 'error'
      badge?: string
    }
  }
  __ga_identity__?: {
    client_id?: string
    session_id?: string
    session_number?: string
  }
  dataLayer?: Array<Record<string, unknown>>
}

interface Navigator {
  /**
   * Used by the electron API.  This is a WICG non-standard API, but is guaranteed to exist in Electron.
   * It is `undefined` in Firefox and older browsers.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/windowControlsOverlay
   */
  windowControlsOverlay?: {
    /** When `true`, the window is using custom window style. */
    visible: boolean
  }
}
