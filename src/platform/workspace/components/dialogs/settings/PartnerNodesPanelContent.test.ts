import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import PartnerNodesPanelContent from './PartnerNodesPanelContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { clear: 'Clear' },
      workspacePanel: {
        partnerNodes: {
          title: 'Partner Nodes Prototype',
          description: 'Preview node discovery.',
          prototypeTitle: 'Local UX prototype',
          prototypeDescription:
            'Changes are stored only in this browser for the active workspace.',
          searchPlaceholder: 'Search partner nodes',
          enableFiltered: 'Enable filtered',
          disableFiltered: 'Disable filtered',
          enabledCount: '{enabled} of {total} enabled',
          empty: 'No partner nodes are available.',
          noResults: 'No partner nodes match this search.',
          toggleLabel: 'Show {node} in modern node discovery',
          defaultDeny: 'New partner nodes start disabled.'
        }
      }
    }
  }
})

function createPartnerNode(
  name: string,
  displayName: string,
  provider: string
): ComfyNodeDef {
  return {
    name,
    display_name: displayName,
    category: `api/${provider}`,
    python_module: 'test',
    description: '',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    deprecated: false,
    experimental: false,
    api_node: true
  }
}

function activateTeamWorkspace() {
  const workspaceStore = useTeamWorkspaceStore()
  workspaceStore.workspaces = [
    {
      id: 'workspace-1',
      name: 'Acme',
      type: 'team',
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      isSubscribed: false,
      subscriptionPlan: null,
      subscriptionTier: null,
      members: [],
      pendingInvites: []
    }
  ]
  workspaceStore.activeWorkspaceId = 'workspace-1'
}

describe('PartnerNodesPanelContent', () => {
  beforeEach(() => {
    localStorage.clear()
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
    activateTeamWorkspace()
    useNodeDefStore().updateNodeDefs([
      createPartnerNode('OpenAIImage', 'OpenAI Image', 'OpenAI'),
      createPartnerNode('AdobeFirefly', 'Adobe Firefly', 'Adobe')
    ])
  })

  it('explains the prototype boundary and enables filtered nodes', async () => {
    const user = userEvent.setup()
    render(PartnerNodesPanelContent, {
      global: {
        plugins: [i18n]
      }
    })

    expect(screen.getByText('Local UX prototype')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Changes are stored only in this browser for the active workspace.'
      )
    ).toBeInTheDocument()

    const search = screen.getByRole('combobox')
    await user.type(search, 'OpenAI')

    expect(screen.getByText('OpenAI Image')).toBeInTheDocument()
    expect(screen.queryByText('Adobe Firefly')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enable filtered' }))

    expect(
      screen.getByRole('switch', {
        name: 'Show OpenAI Image in modern node discovery'
      })
    ).toHaveAttribute('aria-checked', 'true')
  })
})
