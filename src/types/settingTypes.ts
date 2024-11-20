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

export interface SettingParams extends SettingItem {
  id: keyof Settings
  onChange?: (newValue: any, oldValue?: any) => void
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

/**
 * The base setting item for rendering in the setting dialog.
 */
export interface SettingItem {
  name: string
  type: SettingInputType | SettingCustomRenderer
  tooltip?: string
  defaultValue: any
  attrs?: Record<string, any>
  options?: Array<string | SettingOption> | ((value: any) => SettingOption[])
}
