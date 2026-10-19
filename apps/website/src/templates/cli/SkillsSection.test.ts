import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import { externalLinks } from '@/config/routes'
import SkillsSection from './SkillsSection.vue'

describe('CLI skill briefs', () => {
  it.for(['en', 'zh-CN', 'ja'] as const)(
    'shows a prompt once and copies it in full for %s',
    async (locale) => {
      const user = userEvent.setup()
      const { t } = translationsFor(locale)
      render(SkillsSection, { props: { locale } })
      const prompt = t('cli.skills.card.packshots.prompt')

      expect(screen.getAllByRole('article')).toHaveLength(6)
      expect(screen.getAllByRole('img')).toHaveLength(6)
      expect(
        screen.getByRole('link', {
          name: t('cli.skills.moreSkillsLinkLabel').toUpperCase()
        })
      ).toHaveAttribute('href', externalLinks.mcpSkills)
      expect(screen.getAllByText(prompt)).toHaveLength(1)
      const card = screen.getAllByRole('article')[0]
      await user.click(
        within(card).getByRole('button', {
          name: new RegExp(`^${t('cli.skills.promptCopyLabel')}:`, 'i')
        })
      )
      expect(await navigator.clipboard.readText()).toBe(prompt)
    }
  )
})

it('uses the catalog Accordion and preserves all five bundled definitions', async () => {
  const user = userEvent.setup()
  const { t } = translationsFor('en')
  render(SkillsSection)
  const trigger = screen.getByRole('button', {
    name: t('cli.skills.bundledLabel')
  })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await user.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getAllByRole('term')).toHaveLength(5)
  expect(screen.getAllByRole('definition')).toHaveLength(5)
  expect(screen.getByText(t('cli.skills.bundled.comfyFragments'))).toBeVisible()
  await user.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
})
