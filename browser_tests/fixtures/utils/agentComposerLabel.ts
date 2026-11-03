import { escapeRegExp } from 'es-toolkit'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

const { t } = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global

const EITHER_PLACEHOLDER = `(?:${escapeRegExp(t('agent.placeholder'))}|${escapeRegExp(t('agent.placeholderWithoutSkills'))})`

export const AGENT_COMPOSER_LABEL = new RegExp(`^${EITHER_PLACEHOLDER}$`)
