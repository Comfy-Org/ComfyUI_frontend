import { escapeRegExp } from 'es-toolkit'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

// The composer names itself with the rendered placeholder, escapes resolved;
// which placeholder depends on whether saved skills are available. The app's
// own i18n module is a Vite build, so this renders the messages with the same
// library over the same locale file.
const { t } = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global

/** The agent composer's exact accessible name, with or without skills. */
export const AGENT_COMPOSER_LABEL = new RegExp(
  `^(?:${escapeRegExp(t('agent.placeholder'))}|${escapeRegExp(t('agent.placeholderWithoutSkills'))})$`
)
