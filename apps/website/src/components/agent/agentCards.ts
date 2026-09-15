import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

/**
 * Pitch cards for the agent landing page. Kept out of the `.astro`
 * frontmatter so the `website-unit` gate can measure them: V8 cannot
 * instrument `.astro` files.
 */
export interface AgentCard {
  tag: string
  title: string
  body: string
}

/** Key stems of the four cards, in the order the page renders them. */
const CARD_KEYS = ['knowledge', 'multiplayer', 'control', 'anywhere'] as const

export function getAgentCards(locale: Locale = 'en'): readonly AgentCard[] {
  return CARD_KEYS.map((key) => ({
    tag: t(`agent.cards.${key}.tag`, locale),
    title: t(`agent.cards.${key}.title`, locale),
    body: t(`agent.cards.${key}.body`, locale)
  }))
}
