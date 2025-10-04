import arCommands from '@frontend-locales/ar/commands.json' with { type: 'json' }
import ar from '@frontend-locales/ar/main.json' with { type: 'json' }
import arNodes from '@frontend-locales/ar/nodeDefs.json' with { type: 'json' }
import arSettings from '@frontend-locales/ar/settings.json' with { type: 'json' }
import enCommands from '@frontend-locales/en/commands.json' with { type: 'json' }
import en from '@frontend-locales/en/main.json' with { type: 'json' }
import enNodes from '@frontend-locales/en/nodeDefs.json' with { type: 'json' }
import enSettings from '@frontend-locales/en/settings.json' with { type: 'json' }
import esCommands from '@frontend-locales/es/commands.json' with { type: 'json' }
import es from '@frontend-locales/es/main.json' with { type: 'json' }
import esNodes from '@frontend-locales/es/nodeDefs.json' with { type: 'json' }
import esSettings from '@frontend-locales/es/settings.json' with { type: 'json' }
import frCommands from '@frontend-locales/fr/commands.json' with { type: 'json' }
import fr from '@frontend-locales/fr/main.json' with { type: 'json' }
import frNodes from '@frontend-locales/fr/nodeDefs.json' with { type: 'json' }
import frSettings from '@frontend-locales/fr/settings.json' with { type: 'json' }
import jaCommands from '@frontend-locales/ja/commands.json' with { type: 'json' }
import ja from '@frontend-locales/ja/main.json' with { type: 'json' }
import jaNodes from '@frontend-locales/ja/nodeDefs.json' with { type: 'json' }
import jaSettings from '@frontend-locales/ja/settings.json' with { type: 'json' }
import koCommands from '@frontend-locales/ko/commands.json' with { type: 'json' }
import ko from '@frontend-locales/ko/main.json' with { type: 'json' }
import koNodes from '@frontend-locales/ko/nodeDefs.json' with { type: 'json' }
import koSettings from '@frontend-locales/ko/settings.json' with { type: 'json' }
import ruCommands from '@frontend-locales/ru/commands.json' with { type: 'json' }
import ru from '@frontend-locales/ru/main.json' with { type: 'json' }
import ruNodes from '@frontend-locales/ru/nodeDefs.json' with { type: 'json' }
import ruSettings from '@frontend-locales/ru/settings.json' with { type: 'json' }
import trCommands from '@frontend-locales/tr/commands.json' with { type: 'json' }
import tr from '@frontend-locales/tr/main.json' with { type: 'json' }
import trNodes from '@frontend-locales/tr/nodeDefs.json' with { type: 'json' }
import trSettings from '@frontend-locales/tr/settings.json' with { type: 'json' }
import zhTWCommands from '@frontend-locales/zh-TW/commands.json' with { type: 'json' }
import zhTW from '@frontend-locales/zh-TW/main.json' with { type: 'json' }
import zhTWNodes from '@frontend-locales/zh-TW/nodeDefs.json' with { type: 'json' }
import zhTWSettings from '@frontend-locales/zh-TW/settings.json' with { type: 'json' }
import zhCommands from '@frontend-locales/zh/commands.json' with { type: 'json' }
import zh from '@frontend-locales/zh/main.json' with { type: 'json' }
import zhNodes from '@frontend-locales/zh/nodeDefs.json' with { type: 'json' }
import zhSettings from '@frontend-locales/zh/settings.json' with { type: 'json' }
import { createI18n } from 'vue-i18n'

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
  ar: buildLocale(ar, arNodes, arCommands, arSettings),
  tr: buildLocale(tr, trNodes, trCommands, trSettings)
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
export const { t, te } = i18n.global

/**
 * Safe translation function that returns the fallback message if the key is not found.
 *
 * @param key - The key to translate.
 * @param fallbackMessage - The fallback message to use if the key is not found.
 */
export function st(key: string, fallbackMessage: string) {
  return te(key) ? t(key) : fallbackMessage
}
