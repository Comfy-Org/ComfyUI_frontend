/**
 * The shared, tested auth validation rules bound to this site's i18n. The
 * site's `t` has no parameter interpolation, so the `{length}`-style tokens
 * the schema messages carry are filled in here.
 */
import type { AuthSchemaTranslate } from '@comfyorg/auth-core/signInSchemas'
import { createAuthSchemas } from '@comfyorg/auth-core/signInSchemas'

import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export function interpolate(
  template: string,
  params: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  )
}

export function authSchemasFor(locale: Locale) {
  const translate: AuthSchemaTranslate = (key, params) =>
    interpolate(t(key, locale), params)
  return createAuthSchemas(translate)
}
