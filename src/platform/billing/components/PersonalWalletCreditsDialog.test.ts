import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { PersonalWalletCredential } from '@/platform/workflowErrors/errorCatalog/runtimeErrorMatcher'

import PersonalWalletCreditsDialog from './PersonalWalletCreditsDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      credits: {
        personalWallet: {
          title: 'Your personal account is out of credits',
          sessionDescription:
            'This session bills your personal account. To bill a team instead, switch to its workspace.',
          sessionNoTeamsDescription:
            'This session bills your personal account. Add personal credits to continue.',
          apiKeyDescription:
            'This key bills your personal account. Create a team API key or add personal credits.',
          switchTo: 'Switch to {workspaceName}',
          createTeamApiKey: 'Create a team API key',
          addCredits: 'Add personal credits'
        }
      }
    }
  }
})

const TEAM_API_KEYS_URL = 'https://platform.comfy.org/profile/api-keys'

function renderDialog(
  credential: PersonalWalletCredential,
  teamWorkspaces: { id: string; name: string }[]
) {
  const handlers = {
    onSwitchWorkspace: vi.fn(),
    onAddCredits: vi.fn(),
    onClose: vi.fn()
  }
  render(PersonalWalletCreditsDialog, {
    props: {
      credential,
      teamWorkspaces,
      teamApiKeysUrl: TEAM_API_KEYS_URL,
      ...handlers
    },
    global: { plugins: [i18n] }
  })
  return handlers
}

describe('PersonalWalletCreditsDialog', () => {
  it('offers to switch to each team workspace when the session has teams', async () => {
    const user = userEvent.setup()
    const { onSwitchWorkspace } = renderDialog('session', [
      { id: 'ws-acme', name: 'Acme' },
      { id: 'ws-beta', name: 'Beta' }
    ])

    expect(
      screen.getByText(
        'This session bills your personal account. To bill a team instead, switch to its workspace.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Switch to Acme' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add personal credits' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Switch to Beta' }))

    expect(onSwitchWorkspace).toHaveBeenCalledExactlyOnceWith('ws-beta')
  })

  it('offers to add credits when the session has no team workspaces', async () => {
    const user = userEvent.setup()
    const { onAddCredits } = renderDialog('session', [])

    expect(
      screen.getByText(
        'This session bills your personal account. Add personal credits to continue.'
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Switch to/ })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Add personal credits' })
    )

    expect(onAddCredits).toHaveBeenCalledOnce()
  })

  it('links an API key to team API keys and offers personal credits', () => {
    renderDialog('api_key', [{ id: 'ws-acme', name: 'Acme' }])

    expect(
      screen.getByText(
        'This key bills your personal account. Create a team API key or add personal credits.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Create a team API key' })
    ).toHaveAttribute('href', TEAM_API_KEYS_URL)
    expect(
      screen.getByRole('button', { name: 'Add personal credits' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Switch to/ })
    ).not.toBeInTheDocument()
  })
})
