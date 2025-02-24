import type { Settings } from '@/schemas/apiSchema'

export type SettingInputType =
  | 'boolean'
  | 'number'
  | 'slider'
  | 'knob'
  | 'combo'
  | 'text'
  | 'image'
  | 'color'
  | 'url'
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

export interface SettingParams extends FormItem {
  id: keyof Settings
  defaultValue: any | (() => any)
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
 * The base form item for rendering in a form.
 */
export interface FormItem {
  name: string
  type: SettingInputType | SettingCustomRenderer
  tooltip?: string
  attrs?: Record<string, any>
  options?: Array<string | SettingOption>
}

export interface ISettingGroup {
  label: string
  settings: SettingParams[]
}
