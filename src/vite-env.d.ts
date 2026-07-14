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

    /**
     * Overrides the host the API WebSocket dials, falling back to
     * `location.host` when unset. Injected at deploy time by static hosts
     * whose rewrites are HTTP-only (e.g. Vercel) and therefore cannot proxy
     * the `/ws` upgrade, letting the socket target a WebSocket-capable host
     * while HTTP calls keep flowing through the rewrites. Expects a bare host
     * with no scheme (e.g. `ws.example.com`, not `wss://ws.example.com`).
     */
    __COMFY_API_WS_HOST__?: string
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
