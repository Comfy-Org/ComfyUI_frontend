import type { AuthSchemaTranslate } from '@comfyorg/account-core/signInSchemas'
import { createAuthSchemas } from '@comfyorg/account-core/signInSchemas'

import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export function authSchemasFor(locale: Locale) {
  const translate: AuthSchemaTranslate = (key, params) =>
    t(key, params ?? {}, { locale })
  return createAuthSchemas(translate)
}
