import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import DeploySetupAgentMenu from '@/platform/openOnCloud/components/DeploySetupAgentMenu.vue'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { testI18n } from '@/utils/__tests__/testI18n'

vi.mock(
  import('@/platform/workflow/deploy/composables/useAgentHandoff'),
  () => {
    const copyBrief = vi.fn(() => Promise.resolve(true))
    const openBriefIn = vi.fn()
    return { useAgentHandoff: () => fromPartial({ copyBrief, openBriefIn }) }
  }
)

function renderMenu() {
  render(DeploySetupAgentMenu, { global: { plugins: [testI18n] } })
  return userEvent.setup()
}

async function pickRow(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByTestId('deploy-setup-agent'))
  await user.click(await screen.findByRole('menuitem', { name }))
}

describe('DeploySetupAgentMenu', () => {
  it('offers the two desktop apps and Copy prompt, without Use local agent', async () => {
    const user = renderMenu()

    await user.click(screen.getByTestId('deploy-setup-agent'))

    expect(
      (await screen.findAllByRole('menuitem')).map((row) =>
        row.textContent.trim()
      )
    ).toEqual([
      'Open in Claude desktop',
      'Open in ChatGPT desktop',
      'Copy prompt'
    ])
  })

  it.for([
    { row: 'Open in Claude desktop', app: 'claude' },
    { row: 'Open in ChatGPT desktop', app: 'chatGpt' }
  ])('$row opens the brief in that app', async ({ row, app }) => {
    const user = renderMenu()

    await pickRow(user, row)

    expect(useAgentHandoff().openBriefIn).toHaveBeenCalledExactlyOnceWith(app)
  })

  it('says Copied after Copy prompt, and shows its label again when the menu reopens', async () => {
    const user = renderMenu()
    const button = screen.getByTestId('deploy-setup-agent')

    await pickRow(user, 'Copy prompt')
    expect(button).toHaveTextContent(/^Copied/)

    await user.click(button)
    expect(button).toHaveTextContent('Build with your agent')
  })

  it('keeps its label when the brief did not reach the clipboard', async () => {
    vi.mocked(useAgentHandoff().copyBrief).mockResolvedValueOnce(false)
    const user = renderMenu()

    await pickRow(user, 'Copy prompt')

    expect(screen.getByTestId('deploy-setup-agent')).toHaveTextContent(
      'Build with your agent'
    )
  })
})
