import { createI18n } from 'vue-i18n'

import enCommands from './locales/en/commands.json'
import en from './locales/en/main.json'
import enNodes from './locales/en/nodeDefs.json'
import enSettings from './locales/en/settings.json'
import esCommands from './locales/es/commands.json'
import es from './locales/es/main.json'
import esNodes from './locales/es/nodeDefs.json'
import esSettings from './locales/es/settings.json'
import frCommands from './locales/fr/commands.json'
import fr from './locales/fr/main.json'
import frNodes from './locales/fr/nodeDefs.json'
import frSettings from './locales/fr/settings.json'
import jaCommands from './locales/ja/commands.json'
import ja from './locales/ja/main.json'
import jaNodes from './locales/ja/nodeDefs.json'
import jaSettings from './locales/ja/settings.json'
import koCommands from './locales/ko/commands.json'
import ko from './locales/ko/main.json'
import koNodes from './locales/ko/nodeDefs.json'
import koSettings from './locales/ko/settings.json'
import ruCommands from './locales/ru/commands.json'
import ru from './locales/ru/main.json'
import ruNodes from './locales/ru/nodeDefs.json'
import ruSettings from './locales/ru/settings.json'
import zhCommands from './locales/zh/commands.json'
import zh from './locales/zh/main.json'
import zhNodes from './locales/zh/nodeDefs.json'
import zhSettings from './locales/zh/settings.json'

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
  ru: buildLocale(ru, ruNodes, ruCommands, ruSettings),
  ja: buildLocale(ja, jaNodes, jaCommands, jaSettings),
  ko: buildLocale(ko, koNodes, koCommands, koSettings),
  fr: buildLocale(fr, frNodes, frCommands, frSettings),
  es: buildLocale(es, esNodes, esCommands, esSettings)
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
