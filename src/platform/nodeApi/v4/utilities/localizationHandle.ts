import { mergeExtensionI18n } from '@/i18n'
import { SUPPORTED_LOCALE_OPTIONS } from '@/locales/localeConfig'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { frozenSavable } from '@/platform/nodeApi/shared/savableValue'
import type {
  LocalizationCatalog,
  LocalizationHandle
} from '@/platform/nodeApi/v4/types'

import { isObject, packObject } from './packArguments'

const MEMBER = 'localization.registerCatalog'

const MESSAGES = 'an object of strings, null and nested objects'

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
      const given = packObject(
        MEMBER,
        'a catalog',
        catalog,
        CATALOG_FIELDS,
        '',
        ['phrases']
      ).required('messages', isObject, MESSAGES)
      const messages = frozenSavable(given)
      if (!holdsOnlyMessages(messages)) {
        throw invalidArgument(MEMBER, `messages as ${MESSAGES}`, given)
      }
      mergeExtensionI18n(supported, messages)
    }
  }
  return Object.freeze(localization)
}

function holdsOnlyMessages(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (item: unknown) =>
        item === null || typeof item === 'string' || holdsOnlyMessages(item)
    )
  )
}
