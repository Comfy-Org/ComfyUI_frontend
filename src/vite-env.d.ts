/// <reference types="vite/client" />

declare module 'virtual:icons/*' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

declare module '~icons/*' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

declare global {
  interface Window {
    __COMFYUI_FRONTEND_VERSION__: string
  }

  interface ImportMetaEnv {
    VITE_APP_VERSION?: string
    VITE_POSTHOG_DEBUG?: string
    VITE_POSTHOG_PROJECT_TOKEN?: string
    VITE_STAGING_API_BASE_URL?: string
    VITE_STAGING_CLOUD_BASE_URL?: string
    VITE_STAGING_PLATFORM_BASE_URL?: string
    VITE_STRIPE_PAYMENT_METHOD_CONFIGURATION_ID?: string
    VITE_STRIPE_PUBLISHABLE_KEY?: string
    VITE_USE_LEGACY_DEFAULT_GRAPH?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}
