import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE } from '../../../config/locales'
import type { MessageKey } from '../../../i18n/translations'
import en from '../../../locales/en/studio.json' with { type: 'json' }
import ja from '../../../locales/ja/studio.json' with { type: 'json' }
import zhCN from '../../../locales/zh-CN/studio.json' with { type: 'json' }

const studioI18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, 'zh-CN': zhCN, ja },
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false
})

export const { t: studioT } = studioI18n.global

export type CinematicCopyKey = MessageKey<{ cinematic: typeof en.cinematic }>
export type ReshootCopyKey = MessageKey<{ reshoot: typeof en.reshoot }>
