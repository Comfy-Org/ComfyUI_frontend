/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SYFT_SOURCE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  syft?: {
    identify: (...args: unknown[]) => void
    signup: (...args: unknown[]) => void
    track: (...args: unknown[]) => void
    page: (...args: unknown[]) => void
    q?: unknown[][]
    fi?: unknown[]
  }
  syftc?: { sourceId: string }
}
