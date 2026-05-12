import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import OAuthConsentView from '@/platform/cloud/oauth/OAuthConsentView.vue'
import type { OAuthConsentChallenge } from '@/platform/cloud/oauth/oauthApi'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      oauth: {
        consent: {
          allow: 'Allow',
          deny: 'Deny',
          genericError: 'OAuth request failed.',
          loading: 'Loading OAuth request...',
          missingRequest: 'This OAuth request is missing.',
          noWorkspaces: 'No eligible workspaces are available.',
          resourceLabel: 'Authorize this app',
          scopesTitle: 'Requested access',
          workspaceTitle: 'Choose workspace'
        }
      }
    }
  }
})

const challenge: OAuthConsentChallenge = {
  oauth_request_id: '550e8400-e29b-41d4-a716-446655440000',
  csrf_token: 'csrf-token',
  client_display_name: 'Cursor',
  resource_display_name: 'ComfyUI MCP',
  scopes: ['mcp:tools:read', 'mcp:tools:call', 'mcp:unknown:test'],
  workspaces: [
    {
      id: 'personal-workspace',
      name: 'Personal',
      type: 'personal',
      role: 'owner'
    },
    {
      id: 'team-workspace',
      name: 'Team',
      type: 'team',
      role: 'member'
    }
  ]
}

const renderConsent = (
  overrides: Partial<OAuthConsentChallenge> = {},
  submitDecision = vi.fn()
) =>
  render(OAuthConsentView, {
    global: { plugins: [i18n] },
    props: {
      initialChallenge: { ...challenge, ...overrides },
      submitDecision
    }
  })

describe('OAuthConsentView', () => {
  it('renders client, resource, and scopes from the challenge', () => {
    renderConsent()

    expect(screen.getByText('Cursor')).toBeVisible()
    expect(screen.getByText('ComfyUI MCP')).toBeVisible()
    expect(screen.getByText('mcp:tools:read')).toBeVisible()
    expect(screen.getByText('mcp:tools:call')).toBeVisible()
    expect(screen.getByText('mcp:unknown:test')).toBeVisible()
  })

  it('requires workspace selection when multiple workspaces are available', async () => {
    const user = userEvent.setup()
    const submitDecision = vi.fn()
    renderConsent({}, submitDecision)

    const allow = screen.getByRole('button', { name: 'Allow' })
    expect(allow).toBeDisabled()

    await user.click(screen.getByLabelText(/Team/))
    expect(allow).toBeEnabled()

    await user.click(allow)

    expect(submitDecision).toHaveBeenCalledWith({
      oauthRequestId: '550e8400-e29b-41d4-a716-446655440000',
      csrfToken: 'csrf-token',
      decision: 'allow',
      workspaceId: 'team-workspace'
    })
  })

  it('renders a single workspace read-only without auto-submitting', async () => {
    const user = userEvent.setup()
    const submitDecision = vi.fn()
    renderConsent(
      {
        workspaces: [challenge.workspaces[0]]
      },
      submitDecision
    )

    expect(screen.getByText('Personal')).toBeVisible()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(submitDecision).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Allow' }))

    expect(submitDecision).toHaveBeenCalledWith({
      oauthRequestId: '550e8400-e29b-41d4-a716-446655440000',
      csrfToken: 'csrf-token',
      decision: 'allow',
      workspaceId: 'personal-workspace'
    })
  })

  it('submits deny with the selected workspace', async () => {
    const user = userEvent.setup()
    const submitDecision = vi.fn()
    renderConsent({}, submitDecision)

    await user.click(screen.getByLabelText(/Team/))
    await user.click(screen.getByRole('button', { name: 'Deny' }))

    expect(submitDecision).toHaveBeenCalledWith({
      oauthRequestId: '550e8400-e29b-41d4-a716-446655440000',
      csrfToken: 'csrf-token',
      decision: 'deny',
      workspaceId: 'team-workspace'
    })
  })
})
