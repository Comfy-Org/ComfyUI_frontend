import type { ComfyExtension } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type ExcludeFunctions<T> = T extends Function ? never : T
type StaticOnly<T> = {
  // eslint-disable-next-line prettier/prettier
  [K in keyof T as ExcludeFunctions<T[K]> extends never ? never : K]: ExcludeFunctions<T[K]>
}

type StaticComfyCommand = StaticOnly<
  NonNullable<ComfyExtension['commands']>[number]
>
type StaticComfySettingParams = StaticOnly<
  NonNullable<ComfyExtension['settings']>[number]
>
type StaticComfyKeybinding = StaticOnly<
  NonNullable<ComfyExtension['keybindings']>[number]
>
type StaticComfyMenuCommandGroup = StaticOnly<
  NonNullable<ComfyExtension['menuCommands']>[number]
>

export type ComfyExtensionActivationEvent =
  | '*'
  | 'onWidgets:contributes'
  | 'onCommands:contributes'
  | 'onSettings:contributes'

type ComfyExtensionContributes = {
  name: string
  widgets?: string[]
  commands?: StaticComfyCommand[]
  settings?: StaticComfySettingParams[]
  keybindings?: StaticComfyKeybinding[]
}

export interface ComfyExtensionConfig {
  name?: string

  activationEvents: ComfyExtensionActivationEvent[]

  contributes?: ComfyExtensionContributes | ComfyExtensionContributes[]
  menuCommands?: StaticComfyMenuCommandGroup[]

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
