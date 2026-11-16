import type {
  SettingOption as HostSettingOption,
  SettingParams,
  Settings
} from '@comfyorg/settings-core/types'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import { savedCopy } from '@/platform/nodeApi/shared/savedCopy'
import { useSettingStore } from '@/platform/settings/settingStore'

import type {
  SettingsHandle,
  SettingType,
  SettingValue
} from '@/platform/nodeApi/v4/types'
import {
  isBoolean,
  isCallback,
  isFiniteNumber,
  isList,
  isName,
  isObject,
  isStoreKey,
  isText,
  listOf,
  packObject
} from './packArguments'
import type { Check } from './packArguments'
import { isJsonValue } from './jsonValues'

interface SettingChange {
  readonly id: string
  readonly value: unknown
  readonly oldValue: unknown
}

export function createSettingsHandle(): SettingsHandle {
  const onAnySettingChange = createHostEvent<[SettingChange]>(
    'settings.onChange',
    (emit) => useSettingStore().onSettingChanged(emit).off
  )

  const settings: SettingsHandle = {
    declare(setting) {
      const params = settingParams(setting)
      const store = useSettingStore()
      if (Object.hasOwn(store.settingsById, params.id)) {
        throw invalidArgument(
          'settings.declare',
          'an id no other setting has',
          params.id
        )
      }
      store.addSetting(params)
    },

    get(id) {
      if (!isName(id)) throw invalidArgument('settings.get', 'a setting id', id)
      return frozenSettingValue(useSettingStore().get(hostSettingId(id)))
    },

    set(id, value) {
      if (!isName(id)) throw invalidArgument('settings.set', 'a setting id', id)
      if (!isSettingValue(value)) {
        throw invalidArgument('settings.set', 'a value JSON can hold', value)
      }
      return useSettingStore().set(hostSettingId(id), hostSettingValue(value))
    },

    onChange(id, listener) {
      if (!isName(id)) {
        throw invalidArgument('settings.onChange', 'a setting id', id)
      }
      if (!isCallback(listener)) {
        throw invalidArgument(
          'settings.onChange',
          'a function to call',
          listener
        )
      }
      return onAnySettingChange((change) => {
        if (change.id !== id) return
        listener(
          frozenSettingValue(change.value),
          frozenSettingValue(change.oldValue)
        )
      })
    }
  }
  return Object.freeze(settings)
}

const DEFAULT_VALUE_CHECKS: Readonly<
  Record<SettingType, Check<string | number | boolean>>
> = {
  boolean: isBoolean,
  number: isFiniteNumber,
  slider: isFiniteNumber,
  combo: isOptionValue,
  text: isText,
  color: isText
}

function isSettingType(value: unknown): value is SettingType {
  return typeof value === 'string' && Object.hasOwn(DEFAULT_VALUE_CHECKS, value)
}

function isOptionValue(value: unknown): value is string | number {
  return isText(value) || isFiniteNumber(value)
}

function settingParams(setting: unknown): SettingParams {
  const fields = packObject('settings.declare', 'a setting definition', setting)
  const id = fields.required(
    'id',
    isStoreKey,
    'a non-empty string no object inherits'
  )
  const name = fields.required('name', isText, 'a string')
  const type = fields.required(
    'type',
    isSettingType,
    `one of ${Object.keys(DEFAULT_VALUE_CHECKS).join(', ')}`
  )
  const defaultValue = fields.required(
    'defaultValue',
    DEFAULT_VALUE_CHECKS[type],
    `a value a ${type} setting holds`
  )
  const tooltip = fields.optional('tooltip', isText, 'a string')
  const category = fields.optional(
    'category',
    listOf(isText),
    'a list of strings'
  )
  const options = fields.optional('options', isList, 'a list')
  const attrs = fields.optional('attrs', isObject, 'an object')
  const onChange = fields.optional('onChange', isCallback, 'a function')
  return {
    id: hostSettingId(id),
    name,
    type,
    defaultValue,
    tooltip,
    category: category && [...category],
    options: options && Array.from(options, hostOption),
    attrs: attrs && settingAttrs(attrs),
    onChange:
      onChange &&
      ((value: unknown, previous: unknown) => {
        callListener('settings.declare', () =>
          onChange(frozenSettingValue(value), frozenSettingValue(previous))
        )
      })
  }
}

function hostSettingId(id: string): keyof Settings {
  return id as keyof Settings
}

function hostSettingValue(value: SettingValue): Settings[keyof Settings] {
  return value as Settings[keyof Settings]
}

function hostOption(
  option: unknown,
  index: number
): string | HostSettingOption {
  if (isText(option)) return option
  const fields = packObject(
    'settings.declare',
    'options of strings or { value, label }',
    option,
    `options[${index}].`
  )
  return {
    value: fields.required('value', isOptionValue, 'a string or finite number'),
    text: fields.required('label', isText, 'a string')
  }
}

function settingAttrs(attrs: object): Record<string, number> {
  const fields = packObject('settings.declare', 'attrs', attrs, 'attrs.')
  const bounds: Record<string, number> = {}
  for (const key of ['min', 'max', 'step']) {
    const bound = fields.optional(key, isFiniteNumber, 'a finite number')
    if (bound !== undefined) bounds[key] = bound
  }
  return bounds
}

function frozenSettingValue(value: unknown): SettingValue | undefined {
  return isSettingValue(value) ? savedCopy(value) : undefined
}

function isSettingValue(value: unknown): value is SettingValue {
  return isJsonValue(value)
}
