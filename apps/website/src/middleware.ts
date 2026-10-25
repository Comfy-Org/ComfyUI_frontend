import { defineMiddleware } from 'astro:middleware'

import { resolveLocale } from './config/locales'
import { translationsFor } from './i18n/translations'

export const onRequest = defineMiddleware((context, next) => {
  context.locals.t = translationsFor(resolveLocale(context.currentLocale)).t
  return next()
})
