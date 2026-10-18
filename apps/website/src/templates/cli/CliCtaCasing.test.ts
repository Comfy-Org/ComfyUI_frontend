import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import HeroSection from './HeroSection.vue'
import CliAgentExperience from './CliAgentExperience.vue'
import SkillsSection from './SkillsSection.vue'
import HowItWorksSection from './HowItWorksSection.vue'
import AIModelsSection from '@/components/product/shared/AIModelsSection.vue'
import ProductCardsSection from '@/components/common/ProductCardsSection.vue'

// Test actual CLI compositions, so a new title-case CTA cannot hide behind a
// system component import. Utility copy controls and prose links are excluded.
describe('CLI CTA casing', () => {
  it.for([
    ['hero', HeroSection],
    ['agent setup', CliAgentExperience],
    ['skills', SkillsSection],
    ['how it works', HowItWorksSection],
    ['model workflows', AIModelsSection],
    ['product cards', ProductCardsSection]
  ] as const)(
    '%s applies uppercase treatment to every CTA',
    ([_, component]) => {
      render(
        defineComponent({
          components: { Section: component },
          template: '<Section />'
        })
      )
      const ctas = [
        ...screen.queryAllByRole('link'),
        ...screen.queryAllByText(/.*/, {
          selector: 'span[data-slot="button"]'
        }),
        ...screen.queryAllByRole('button')
      ].filter((element) => {
        const classes = element.classList
        return (
          classes.contains('bg-primary-comfy-yellow') ||
          (classes.contains('border-primary-comfy-yellow') &&
            !element.hasAttribute('role') &&
            !element.hasAttribute('aria-label'))
        )
      })
      expect(ctas.length).toBeGreaterThan(0)
      for (const cta of ctas) {
        const label = cta.textContent.trim()
        expect(label.length).toBeGreaterThan(0)
        expect(
          cta.classList.contains('uppercase') || label === label.toUpperCase()
        ).toBe(true)
      }
    }
  )
})

it('delivers the repository label as literal uppercase text', () => {
  render(SkillsSection)
  const repository = screen.getByRole('link', {
    name: 'COMFY SKILLS REPOSITORY'
  })
  expect(repository).toHaveTextContent('COMFY SKILLS REPOSITORY')
  expect(
    within(repository).getAllByText(/.*/, { selector: 'svg' })
  ).toHaveLength(1)
  expect(screen.getAllByText('COPY PROMPT')).toHaveLength(6)
})
it('keeps dialog action links uppercase across client and connection states', async () => {
  const user = userEvent.setup()
  render(CliAgentExperience)
  await user.click(screen.getByRole('button', { name: 'SET UP Claude Code' }))
  const dialog = within(screen.getByRole('dialog'))
  for (const connection of ['Local', 'Comfy Cloud']) {
    await user.click(dialog.getByRole('button', { name: connection }))
    for (const client of [
      'Claude Code',
      'Codex',
      'Cursor',
      'Gemini CLI',
      'OpenClaw',
      'Hermes',
      'Terminal',
      'CI / Headless'
    ]) {
      await user.click(dialog.getByRole('tab', { name: client }))
      for (const link of dialog.getAllByRole('link')) {
        expect(link.classList.contains('uppercase')).toBe(true)
      }
    }
  }
})
