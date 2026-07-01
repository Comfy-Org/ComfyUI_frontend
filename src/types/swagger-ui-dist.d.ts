declare module 'swagger-ui-dist' {
  export interface SwaggerUIOptions {
    domNode?: Element | null
    spec?: Record<string, unknown>
    url?: string
    deepLinking?: boolean
    tryItOutEnabled?: boolean
    supportedSubmitMethods?: string[]
    defaultModelsExpandDepth?: number
    [key: string]: unknown
  }

  export function SwaggerUIBundle(options: SwaggerUIOptions): unknown
  export const SwaggerUIStandalonePreset: unknown
  export function absolutePath(): string
  export function getAbsoluteFSPath(): string
}
