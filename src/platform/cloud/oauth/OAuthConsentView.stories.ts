import type { Meta, StoryObj } from '@storybook/vue3-vite'

import OAuthConsentView from '@/platform/cloud/oauth/OAuthConsentView.vue'
import type { OAuthConsentChallenge } from '@/platform/cloud/oauth/oauthApi'

const baseChallenge: OAuthConsentChallenge = {
  oauth_request_id: '550e8400-e29b-41d4-a716-446655440000',
  csrf_token: 'preview-csrf-token',
  client_display_name: 'Cursor',
  resource_display_name: 'Comfy Cloud MCP',
  redirect_uri: 'http://127.0.0.1:50632/cb',
  client_application_type: 'native',
  scopes: ['mcp:tools:read', 'mcp:tools:call'],
  workspaces: [
    {
      id: 'personal-workspace',
      name: 'Personal Workspace',
      type: 'personal',
      role: 'owner'
    },
    {
      id: 'team-workspace',
      name: 'Comfy Team',
      type: 'team',
      role: 'member'
    }
  ]
}

const meta: Meta<typeof OAuthConsentView> = {
  title: 'Cloud/OAuth/Consent',
  component: OAuthConsentView
}
export default meta
type Story = StoryObj<typeof meta>

const noopSubmit = async () => {}

export const TwoWorkspaces: Story = {
  args: { initialChallenge: baseChallenge, submitDecision: noopSubmit }
}

export const SingleWorkspace: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      workspaces: [baseChallenge.workspaces[0]]
    },
    submitDecision: noopSubmit
  }
}

export const ManyWorkspaces: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      workspaces: [
        baseChallenge.workspaces[0],
        baseChallenge.workspaces[1],
        {
          id: 'design-team',
          name: 'Design Studio',
          type: 'team',
          role: 'owner'
        },
        {
          id: 'agency-team',
          name: 'Agency Workspace',
          type: 'team',
          role: 'member'
        }
      ]
    },
    submitDecision: noopSubmit
  }
}

export const UnknownScope: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      scopes: ['mcp:tools:read', 'mcp:tools:call', 'mcp:billing:read']
    },
    submitDecision: noopSubmit
  }
}

export const ClaudeDesktop: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      client_display_name: 'Claude Desktop'
    },
    submitDecision: noopSubmit
  }
}

export const WebClient: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      client_display_name: 'Comfy Studio',
      client_application_type: 'web',
      redirect_uri: 'https://studio.example.com/oauth/cb'
    },
    submitDecision: noopSubmit
  }
}

export const LegacyClientNoBadge: Story = {
  args: {
    // Pre-DCR seeded clients have application_type="" — UI should hide
    // the badge entirely rather than guess.
    initialChallenge: { ...baseChallenge, client_application_type: '' },
    submitDecision: noopSubmit
  }
}
