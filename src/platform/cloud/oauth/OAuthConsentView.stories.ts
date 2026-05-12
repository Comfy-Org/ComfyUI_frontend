import type { Meta, StoryObj } from '@storybook/vue3-vite'

import OAuthConsentView from '@/platform/cloud/oauth/OAuthConsentView.vue'
import type { OAuthConsentChallenge } from '@/platform/cloud/oauth/oauthApi'

const previewChallenge: OAuthConsentChallenge = {
  oauth_request_id: '550e8400-e29b-41d4-a716-446655440000',
  csrf_token: 'preview-csrf-token',
  client_display_name: 'Cursor',
  resource_display_name: 'ComfyUI MCP',
  scopes: ['mcp:tools:read', 'mcp:tools:call', 'mcp:unknown:test'],
  workspaces: [
    {
      id: 'personal-workspace',
      name: 'Personal Workspace',
      type: 'personal',
      role: 'owner'
    },
    {
      id: 'team-workspace',
      name: 'Team Workspace',
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

export const AllMcpScopes: Story = {
  args: {
    initialChallenge: previewChallenge,
    submitDecision: async () => {}
  }
}
