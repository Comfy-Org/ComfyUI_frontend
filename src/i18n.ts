import { createI18n } from 'vue-i18n'

import arCommands from './locales/ar/commands.json' with { type: 'json' }
import ar from './locales/ar/main.json' with { type: 'json' }
import arNodes from './locales/ar/nodeDefs.json' with { type: 'json' }
import arSettings from './locales/ar/settings.json' with { type: 'json' }
import enCommands from './locales/en/commands.json' with { type: 'json' }
import en from './locales/en/main.json' with { type: 'json' }
import enNodes from './locales/en/nodeDefs.json' with { type: 'json' }
import enSettings from './locales/en/settings.json' with { type: 'json' }
import esCommands from './locales/es/commands.json' with { type: 'json' }
import es from './locales/es/main.json' with { type: 'json' }
import esNodes from './locales/es/nodeDefs.json' with { type: 'json' }
import esSettings from './locales/es/settings.json' with { type: 'json' }
import frCommands from './locales/fr/commands.json' with { type: 'json' }
import fr from './locales/fr/main.json' with { type: 'json' }
import frNodes from './locales/fr/nodeDefs.json' with { type: 'json' }
import frSettings from './locales/fr/settings.json' with { type: 'json' }
import jaCommands from './locales/ja/commands.json' with { type: 'json' }
import ja from './locales/ja/main.json' with { type: 'json' }
import jaNodes from './locales/ja/nodeDefs.json' with { type: 'json' }
import jaSettings from './locales/ja/settings.json' with { type: 'json' }
import koCommands from './locales/ko/commands.json' with { type: 'json' }
import ko from './locales/ko/main.json' with { type: 'json' }
import koNodes from './locales/ko/nodeDefs.json' with { type: 'json' }
import koSettings from './locales/ko/settings.json' with { type: 'json' }
import ruCommands from './locales/ru/commands.json' with { type: 'json' }
import ru from './locales/ru/main.json' with { type: 'json' }
import ruNodes from './locales/ru/nodeDefs.json' with { type: 'json' }
import ruSettings from './locales/ru/settings.json' with { type: 'json' }
import zhTWCommands from './locales/zh-TW/commands.json' with { type: 'json' }
import zhTW from './locales/zh-TW/main.json' with { type: 'json' }
import zhTWNodes from './locales/zh-TW/nodeDefs.json' with { type: 'json' }
import zhTWSettings from './locales/zh-TW/settings.json' with { type: 'json' }
import zhCommands from './locales/zh/commands.json' with { type: 'json' }
import zh from './locales/zh/main.json' with { type: 'json' }
import zhNodes from './locales/zh/nodeDefs.json' with { type: 'json' }
import zhSettings from './locales/zh/settings.json' with { type: 'json' }

function buildLocale<M, N, C, S>(main: M, nodes: N, commands: C, settings: S) {
  return {
    ...main,
    nodeDefs: nodes,
    commands: commands,
    settings: settings
  }
}

const messages = {
  en: buildLocale(en, enNodes, enCommands, enSettings),
  zh: buildLocale(zh, zhNodes, zhCommands, zhSettings),
  'zh-TW': buildLocale(zhTW, zhTWNodes, zhTWCommands, zhTWSettings),
  ru: buildLocale(ru, ruNodes, ruCommands, ruSettings),
  ja: buildLocale(ja, jaNodes, jaCommands, jaSettings),
  ko: buildLocale(ko, koNodes, koCommands, koSettings),
  fr: buildLocale(fr, frNodes, frCommands, frSettings),
  es: buildLocale(es, esNodes, esCommands, esSettings),
  ar: buildLocale(ar, arNodes, arCommands, arSettings)
}

export const i18n = createI18n({
  // Must set `false`, as Vue I18n Legacy API is for Vue 2
  legacy: false,
  locale: navigator.language.split('-')[0] || 'en',
  fallbackLocale: 'en',
  messages,
  // Ignore warnings for locale options as each option is in its own language.
  // e.g. "English", "中文", "Русский", "日本語", "한국어", "Français", "Español"
  missingWarn: /^(?!settings\.Comfy_Locale\.options\.).+/,
  fallbackWarn: /^(?!settings\.Comfy_Locale\.options\.).+/
})

/** Convenience shorthand: i18n.global */
export const { t, te, d } = i18n.global

/**
 * Safe translation function that returns the fallback message if the key is not found.
 *
 * @param key - The key to translate.
 * @param fallbackMessage - The fallback message to use if the key is not found.
 */
export function st(key: string, fallbackMessage: string) {
  return te(key) ? t(key) : fallbackMessage
}
