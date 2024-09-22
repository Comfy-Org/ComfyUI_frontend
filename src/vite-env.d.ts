/// <reference types="vite/client" />

declare global {
  interface Window {
    __COMFYUI_FRONTEND_VERSION__: string
  }
}
