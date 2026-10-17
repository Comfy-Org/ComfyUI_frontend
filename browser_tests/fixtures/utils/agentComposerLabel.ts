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

const EITHER_PLACEHOLDER = `(?:${escapeRegExp(t('agent.placeholder'))}|${escapeRegExp(t('agent.placeholderWithoutSkills'))})`

/** The agent composer's exact accessible name, with or without skills. */
export const AGENT_COMPOSER_LABEL = new RegExp(`^${EITHER_PLACEHOLDER}$`)

// The rendered placeholder hint carries a trailing space so the adjacent
// mention-nodes control does not butt against the copy, so this one is not
// anchored at the end. Use it for `getByText`; use the anchored label above
// for an accessible name, which is the aria-label verbatim.
/** The agent composer's rendered placeholder hint, with or without skills. */
export const AGENT_COMPOSER_PLACEHOLDER_TEXT = new RegExp(
  `^${EITHER_PLACEHOLDER}`
)
