import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { TeamWorkspaceMockState } from '@/storybook/mocks/teamWorkspaceStore'
import { setTeamWorkspaceMock } from '@/storybook/mocks/teamWorkspaceStore'
import type { BillingContextMockState } from '@/storybook/mocks/useBillingContext'
import { setBillingContextMock } from '@/storybook/mocks/useBillingContext'
import type { CurrentUserMockState } from '@/storybook/mocks/useCurrentUser'
import { setCurrentUserMock } from '@/storybook/mocks/useCurrentUser'

import '@/workbench/extensions/agent/agentPanel.css'

import AgentAccountMenu from './AgentAccountMenu.vue'

const meta: Meta<typeof AgentAccountMenu> = {
  title: 'Agent/AgentAccountMenu',
  component: AgentAccountMenu,
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-secondary flex h-160 w-65 flex-col p-2"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

function story(
  user: Partial<CurrentUserMockState>,
  billing: Partial<BillingContextMockState>,
  args: Story['args'] = {},
  workspace: Partial<TeamWorkspaceMockState> = {}
): Story {
  return {
    args,
    beforeEach() {
      setCurrentUserMock(user)
      setBillingContextMock(billing)
      setTeamWorkspaceMock(workspace)
      return () => {
        setCurrentUserMock({})
        setBillingContextMock({})
        setTeamWorkspaceMock({})
      }
    }
  }
}

function cloudOnly(workspaceStory: Story): Story {
  return {
    ...workspaceStory,
    parameters: {
      docs: {
        description: {
          story:
            'Run with `DISTRIBUTION=cloud pnpm storybook`. Workspaces are cloud-only, so a plain `pnpm storybook` shows the account trigger instead.'
        }
      }
    }
  }
}

const balance = { amountMicros: 588, currency: 'USD' }

const personal: TeamWorkspaceMockState['workspaces'][number] = {
  id: 'ws-personal',
  name: 'Personal Workspace',
  type: 'personal',
  role: 'owner'
}

const studio: TeamWorkspaceMockState['workspaces'][number] = {
  id: 'ws-studio',
  name: 'Northwind Animation Studio',
  type: 'team',
  role: 'member'
}

const workspaces: Partial<TeamWorkspaceMockState> = {
  initState: 'ready',
  workspaces: [personal, studio],
  activeWorkspaceId: personal.id
}

export const WithPlan: Story = story({}, { tier: 'PRO', balance })

export const FreeTier: Story = story({}, { tier: 'FREE', balance })

export const SignedOut: Story = story(
  { displayName: undefined, email: undefined, isLoggedIn: false },
  {}
)

export const Compact: Story = story(
  {},
  { tier: 'PRO', balance },
  { compact: true }
)

export const WithWorkspaces: Story = cloudOnly(
  story({}, { tier: 'PRO', balance }, {}, workspaces)
)

export const WorkspaceWithoutPlan: Story = cloudOnly(
  story({}, { balance }, {}, workspaces)
)

export const ManyWorkspaces: Story = cloudOnly(
  story(
    {},
    { tier: 'PRO', balance },
    {},
    {
      ...workspaces,
      workspaces: [
        personal,
        studio,
        ...Array.from({ length: 8 }, (_, index) => ({
          ...studio,
          id: `ws-team-${index}`,
          name: `Team ${index + 1}`
        }))
      ]
    }
  )
)

export const CompactWithWorkspace: Story = cloudOnly(
  story({}, { tier: 'PRO', balance }, { compact: true }, workspaces)
)
