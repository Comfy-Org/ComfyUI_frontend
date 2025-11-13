export interface ComfyExtensionConfig {
  comfyCloud?:
    | boolean
    | {
        subscriptionRequired: boolean
      }
}
export type ComfyExtensionConfigs = Record<
  string,
  ComfyExtensionConfig | undefined
>

export interface ComfyExtensionLoadContext {
  readonly isCloud: boolean
  readonly subscriptionRequired: boolean
}

export type ComfyExtensionEntry = () => Promise<Record<string, unknown>>
export type ComfyExtensionEntrance = Record<
  string,
  ComfyExtensionEntry | undefined
>

export interface ComfyExtensionPackage {
  name?: string
  path?: string
  config?: ComfyExtensionConfig
  entry: ComfyExtensionEntry
}
export type ComfyExtensionPackages = Record<string, ComfyExtensionPackage>
