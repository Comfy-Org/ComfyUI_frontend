import type { AuthSchemaTranslate } from '@comfyorg/account-core/signInSchemas'
import { createAuthSchemas } from '@comfyorg/account-core/signInSchemas'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export function authSchemasFor(locale: Locale) {
  const { t } = translationsFor(locale)
  const translate: AuthSchemaTranslate = (key, params) => t(key, params ?? {})
  return createAuthSchemas(translate)
}
