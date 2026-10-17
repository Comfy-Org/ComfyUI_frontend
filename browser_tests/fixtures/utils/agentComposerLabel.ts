import { escapeRegExp } from 'es-toolkit'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

const { t } = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global

const EITHER_PLACEHOLDER = `(?:${escapeRegExp(t('agent.placeholder'))}|${escapeRegExp(t('agent.placeholderWithoutSkills'))})`

/** The agent composer's exact accessible name, with or without skills. */
export const AGENT_COMPOSER_LABEL = new RegExp(`^${EITHER_PLACEHOLDER}$`)

/** The agent composer's rendered placeholder hint prefix, with or without skills. */
export const AGENT_COMPOSER_PLACEHOLDER_TEXT = new RegExp(
  `^${EITHER_PLACEHOLDER}`
)
