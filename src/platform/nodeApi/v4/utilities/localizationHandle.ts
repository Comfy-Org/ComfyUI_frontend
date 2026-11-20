import { isPlainObject } from 'es-toolkit'

import { mergeExtensionI18n } from '@/i18n'
import { SUPPORTED_LOCALE_OPTIONS } from '@/locales/localeConfig'
import { savedCopy } from '@/platform/nodeApi/shared/savedCopy'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type {
  LocalizationCatalog,
  LocalizationHandle
} from '@/platform/nodeApi/v4/types'

import { packObject } from './packArguments'

const MEMBER = 'localization.registerCatalog'

const CATALOG_FIELDS = {
  messages: true
} satisfies Record<keyof LocalizationCatalog, true>

export function createLocalizationHandle(): LocalizationHandle {
  const localization: LocalizationHandle = {
    registerCatalog(locale, catalog) {
      const supported = SUPPORTED_LOCALE_OPTIONS.find(
        ({ value }) => value === locale
      )?.value
      if (!supported) {
        throw invalidArgument(
          MEMBER,
          `a locale the app ships (${SUPPORTED_LOCALE_OPTIONS.map(({ value }) => value).join(', ')})`,
          locale
        )
      }
      const messages = packObject(
        MEMBER,
        'a catalog',
        catalog,
        CATALOG_FIELDS,
        '',
        ['phrases']
      ).required(
        'messages',
        isMessageTree,
        'an object of strings, null and nested objects'
      )
      mergeExtensionI18n(supported, savedCopy(messages))
    }
  }
  return Object.freeze(localization)
}

function isMessageTree(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && holdsOnlyMessages(value, new Set())
}

function holdsOnlyMessages(value: object, holders: Set<object>): boolean {
  if (holders.has(value)) return false
  holders.add(value)
  const valid = Object.values(value).every(
    (item: unknown) =>
      item === null ||
      typeof item === 'string' ||
      (isPlainObject(item) && holdsOnlyMessages(item, holders))
  )
  holders.delete(value)
  return valid
}
