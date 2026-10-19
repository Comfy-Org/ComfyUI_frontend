import { externalLinks } from '@/config/routes'
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
        const label = cta.innerText.trim()
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
  expect(repository).toHaveAttribute('href', externalLinks.mcpSkills)
  expect(screen.getAllByText('COPY PROMPT')).toHaveLength(6)
})
it.for([
  { connection: 'Local', client: 'Claude Code' },
  { connection: 'Local', client: 'Codex' },
  { connection: 'Local', client: 'Cursor' },
  { connection: 'Local', client: 'Gemini CLI' },
  { connection: 'Local', client: 'OpenClaw' },
  { connection: 'Local', client: 'Hermes' },
  { connection: 'Local', client: 'Terminal' },
  { connection: 'Local', client: 'CI / Headless' },
  { connection: 'Comfy Cloud', client: 'Claude Code' },
  { connection: 'Comfy Cloud', client: 'Codex' },
  { connection: 'Comfy Cloud', client: 'Cursor' },
  { connection: 'Comfy Cloud', client: 'Gemini CLI' },
  { connection: 'Comfy Cloud', client: 'OpenClaw' },
  { connection: 'Comfy Cloud', client: 'Hermes' },
  { connection: 'Comfy Cloud', client: 'Terminal' },
  { connection: 'Comfy Cloud', client: 'CI / Headless' }
])(
  'keeps dialog action links uppercase for $client / $connection',
  async ({ connection, client }) => {
    const user = userEvent.setup()
    render(CliAgentExperience)
    await user.click(screen.getByRole('button', { name: 'SET UP Claude Code' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: connection }))
    await user.click(dialog.getByRole('tab', { name: client }))
    expect(
      dialog
        .getAllByRole('link')
        .map((link) => link.classList.contains('uppercase'))
    ).toEqual(dialog.getAllByRole('link').map(() => true))
  }
)
