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
  value?: string
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
}
