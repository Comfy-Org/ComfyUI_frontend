import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import OAuthConsentView from '@/platform/cloud/oauth/OAuthConsentView.vue'
import { OAuthApiError } from '@/platform/cloud/oauth/oauthApi'
import type * as oauthApi from '@/platform/cloud/oauth/oauthApi'
import type { OAuthConsentChallenge } from '@/platform/cloud/oauth/oauthApi'

const submitOAuthConsentDecision = vi.fn()

vi.mock('@/platform/cloud/oauth/oauthApi', async () => {
  const actual = await vi.importActual<typeof oauthApi>(
    '@/platform/cloud/oauth/oauthApi'
  )
  return {
    ...actual,
    submitOAuthConsentDecision: (
      ...args: Parameters<typeof actual.submitOAuthConsentDecision>
    ) => submitOAuthConsentDecision(...args)
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        singleSelectDropdown: 'Select an option'
      },
      oauth: {
        consent: {
          allow: 'Continue',
          deny: 'Cancel',
          genericError: 'OAuth request failed.',
          loading: 'Loading authorization request…',
          missingRequest: 'This authorization request is missing.',
          noWorkspaces: 'No eligible workspaces are available.',
          title: '{client} wants access',
          subtitle: 'Sign in to {resource} to continue',
          workspaceLabel: 'Workspace',
          permissionsHeader: 'Permissions',
          workspaceHelp: 'Permissions apply to this workspace only.',
          redirectNotice: "You'll be redirected to",
          appTypeNative: 'Native app',
          appTypeWeb: 'Web app',
          errorExpired:
            'This consent request has expired or has already been used.',
          errorScopeBroadening:
            "The previously approved permissions don't cover this request.",
          errorUnavailable: "This feature isn't available right now."
        },
        scopes: {
          'mcp:tools:read': {
            label: 'View available workflow tools'
          },
          'mcp:tools:call': {
            label: 'Run workflows on your behalf'
          }
        },
        workspace: {
          personal: 'Personal',
          owner: 'Owner',
          member: 'Member'
        }
      }
    }
  }
})

const challenge: OAuthConsentChallenge = {
  oauth_request_id: '550e8400-e29b-41d4-a716-446655440000',
  csrf_token: 'csrf-token',
  client_display_name: 'Comfy Desktop',
  resource_display_name: 'Comfy Cloud',
  redirect_uri: 'http://127.0.0.1:50632/cb',
  client_application_type: 'native',
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

const renderConsent = (overrides: Partial<OAuthConsentChallenge> = {}) =>
  render(OAuthConsentView, {
    global: { plugins: [i18n] },
    props: {
      initialChallenge: { ...challenge, ...overrides }
    }
  })

describe('OAuthConsentView', () => {
  beforeEach(() => {
    submitOAuthConsentDecision.mockReset().mockResolvedValue(undefined)
  })

  it('renders title, subtitle, and scope checklist', () => {
    renderConsent()

    // Title is "<client> wants access". Subtitle is "Sign in to <resource>
    // to continue". Both are short and avoid repeating any brand name twice.
    expect(screen.getByText('Comfy Desktop wants access')).toBeVisible()
    expect(screen.getByText('Sign in to Comfy Cloud to continue')).toBeVisible()
    // Permissions section header is just the static word "Permissions".
    expect(screen.getByText('Permissions')).toBeVisible()
    // Known scopes render their human-readable labels. We deliberately
    // avoid MCP jargon ("tools", "metadata") — the user thinks in
    // ComfyUI vocabulary (workflows), and the consent UI doesn't show
    // an enumerated tool list, so the label shouldn't promise one.
    expect(screen.getByText('View available workflow tools')).toBeVisible()
    expect(screen.getByText('Run workflows on your behalf')).toBeVisible()
    // Unknown scopes fall back to the raw scope string so a new resource
    // doesn't require a frontend release just to render its consent page.
    expect(screen.getByText('mcp:unknown:test')).toBeVisible()
  })

  it('renders the registered redirect URI verbatim', () => {
    renderConsent()
    // Verbatim render — the user must be able to read the loopback URL
    // and verify it's the localhost callback their CLI is listening on.
    expect(screen.getByText('http://127.0.0.1:50632/cb')).toBeVisible()
    expect(screen.getByText("You'll be redirected to")).toBeVisible()
  })

  it('preselects the only workspace and submits with it', async () => {
    const user = userEvent.setup()
    renderConsent({ workspaces: [challenge.workspaces[0]] })

    // Single-workspace path: Allow is enabled and submission carries the
    // sole workspace_id.
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(submitOAuthConsentDecision).toHaveBeenCalledWith({
      oauthRequestId: '550e8400-e29b-41d4-a716-446655440000',
      csrfToken: 'csrf-token',
      decision: 'allow',
      workspaceId: 'personal-workspace',
      expectedRedirectUri: 'http://127.0.0.1:50632/cb'
    })
  })

  it('keeps Allow disabled when multiple workspaces are available and none is chosen', () => {
    renderConsent()
    const allow = screen.getByRole('button', { name: 'Continue' })
    expect(allow).toBeDisabled()
  })

  it('submits deny when the user cancels', async () => {
    const user = userEvent.setup()
    renderConsent({ workspaces: [challenge.workspaces[0]] })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(submitOAuthConsentDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'deny',
        workspaceId: 'personal-workspace'
      })
    )
  })

  it('disables both buttons when no workspaces are available', () => {
    renderConsent({ workspaces: [] })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('maps OAuthApiError(400) to the expired-request message', async () => {
    submitOAuthConsentDecision.mockRejectedValue(
      new OAuthApiError('expired', 400)
    )
    const user = userEvent.setup()
    renderConsent({ workspaces: [challenge.workspaces[0]] })

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'This consent request has expired or has already been used.'
        )
      ).toBeVisible()
    })
  })

  it('maps OAuthApiError(403) to the scope-broadening re-prompt message', async () => {
    submitOAuthConsentDecision.mockRejectedValue(
      new OAuthApiError('scope broadening', 403)
    )
    const user = userEvent.setup()
    renderConsent({ workspaces: [challenge.workspaces[0]] })

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          "The previously approved permissions don't cover this request."
        )
      ).toBeVisible()
    })
  })

  it('maps OAuthApiError(404) to the feature-unavailable message', async () => {
    submitOAuthConsentDecision.mockRejectedValue(
      new OAuthApiError('disabled', 404)
    )
    const user = userEvent.setup()
    renderConsent({ workspaces: [challenge.workspaces[0]] })

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(
        screen.getByText("This feature isn't available right now.")
      ).toBeVisible()
    })
  })
})
