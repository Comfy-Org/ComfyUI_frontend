import { Settings } from './apiTypes'

export type StorageLocation = 'browser' | 'server'

export type SettingInputType =
  | 'boolean'
  | 'number'
  | 'slider'
  | 'combo'
  | 'text'
  | 'hidden'

export type SettingCustomRenderer = (
  name: string,
  setter: (v: any) => void,
  value: any,
  attrs: any
) => HTMLElement

export interface SettingOption {
  text: string
  value?: any
}

export interface Setting {
  id: keyof Settings
  onChange?: (value: any, oldValue?: any) => void
  name: string
  render: () => HTMLElement
}

export interface SettingParams {
  id: keyof Settings
  name: string
  type: SettingInputType | SettingCustomRenderer
  defaultValue: any
  onChange?: (newValue: any, oldValue?: any) => void
  attrs?: any
  tooltip?: string
  options?: Array<string | SettingOption> | ((value: any) => SettingOption[])
  // By default category is id.split('.'). However, changing id to assign
  // new category has poor backward compatibility. Use this field to overwrite
  // default category from id.
  // Note: Like id, category value need to be unique.
  category?: string[]
  experimental?: boolean
  deprecated?: boolean
  // Deprecated values are mapped to new values.
  migrateDeprecatedValue?: (value: any) => any
  // Version of the setting when it was added
  versionAdded?: string
  // Version of the setting when it was last modified
  versionModified?: string
}
