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
    VITE_STAGING_API_BASE_URL?: string
    VITE_STAGING_PLATFORM_BASE_URL?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}
