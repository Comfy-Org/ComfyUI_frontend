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
    readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
    readonly VITE_STRIPE_PRICING_TABLE_ID?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}
