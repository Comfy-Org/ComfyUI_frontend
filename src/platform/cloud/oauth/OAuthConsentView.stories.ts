import type { Meta, StoryObj } from '@storybook/vue3-vite'

import OAuthConsentView from '@/platform/cloud/oauth/OAuthConsentView.vue'
import type { OAuthConsentChallenge } from '@/platform/cloud/oauth/oauthApi'

const baseChallenge: OAuthConsentChallenge = {
  oauth_request_id: '550e8400-e29b-41d4-a716-446655440000',
  csrf_token: 'preview-csrf-token',
  client_display_name: 'Comfy Desktop',
  resource_display_name: 'Comfy Cloud',
  redirect_uri: 'http://127.0.0.1:50632/cb',
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
  component: OAuthConsentView,
  decorators: [
    () => ({
      template:
        '<div class="dark-theme relative min-h-screen bg-primary-comfy-ink font-sans text-primary-comfy-canvas"><i class="icon-[comfy--comfy-logo] absolute top-6 left-6 h-6 w-26 text-brand-yellow" aria-hidden="true" /><story /></div>'
    })
  ]
}
export default meta
type Story = StoryObj<typeof meta>

export const TwoWorkspaces: Story = {
  args: { initialChallenge: baseChallenge }
}

export const SingleWorkspace: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      workspaces: [baseChallenge.workspaces[0]]
    }
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
    }
  }
}

export const NoWorkspaces: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      workspaces: []
    }
  }
}

export const UnknownScope: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      scopes: ['mcp:tools:read', 'mcp:tools:call', 'mcp:billing:read']
    }
  }
}

export const ComfyCli: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      client_display_name: 'Comfy CLI'
    }
  }
}

export const RemoteWebClient: Story = {
  args: {
    initialChallenge: {
      ...baseChallenge,
      client_display_name: 'Claude',
      resource_display_name: 'Comfy Cloud MCP',
      client_application_type: 'web',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      scopes: ['comfy-mcp:tools:calls']
    }
  }
}
