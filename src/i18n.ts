import { createI18n } from 'vue-i18n'
import en from './locales/en/main.json'
import zh from './locales/zh/main.json'
import ru from './locales/ru/main.json'
import ja from './locales/ja/main.json'
import ko from './locales/ko/main.json'
import enNodes from './locales/en/nodeDefs.json'
import zhNodes from './locales/zh/nodeDefs.json'
import ruNodes from './locales/ru/nodeDefs.json'
import jaNodes from './locales/ja/nodeDefs.json'
import koNodes from './locales/ko/nodeDefs.json'
import enCommands from './locales/en/commands.json'
import zhCommands from './locales/zh/commands.json'
import ruCommands from './locales/ru/commands.json'
import jaCommands from './locales/ja/commands.json'
import koCommands from './locales/ko/commands.json'

function buildLocale<M, N, C>(main: M, nodes: N, commands: C) {
  return {
    ...main,
    nodeDefs: nodes,
    commands: commands
  }
}

const messages = {
  en: buildLocale(en, enNodes, enCommands),
  zh: buildLocale(zh, zhNodes, zhCommands),
  ru: buildLocale(ru, ruNodes, ruCommands),
  ja: buildLocale(ja, jaNodes, jaCommands),
  ko: buildLocale(ko, koNodes, koCommands)
}

export const i18n = createI18n({
  // Must set `false`, as Vue I18n Legacy API is for Vue 2
  legacy: false,
  locale: navigator.language.split('-')[0] || 'en',
  fallbackLocale: 'en',
  messages,
  // Ignore warnings for locale options as each option is in its own language.
  // e.g. "English", "中文", "Русский", "日本語", "한국어"
  missingWarn: /^(?!settingsDialog\.Comfy_Locale\.options\.).+/,
  fallbackWarn: /^(?!settingsDialog\.Comfy_Locale\.options\.).+/
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
