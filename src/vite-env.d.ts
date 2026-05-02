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

  const __COMFYUI_FRONTEND_COMMIT__: string
  const __CI_BRANCH__: string
  const __CI_PR_NUMBER__: string
  const __CI_PR_AUTHOR__: string
  const __CI_RUN_ID__: string
  const __CI_JOB_ID__: string

  interface ImportMetaEnv {
    VITE_APP_VERSION?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}
