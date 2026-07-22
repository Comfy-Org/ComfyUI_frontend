import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type {
  PartnerNodePolicy,
  PartnerProvider
} from '@/platform/workspace/api/partnerNodePolicyApi'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import PartnerNodeAccessPanel from './PartnerNodeAccessPanel.vue'

const mockLoadPolicy = vi.fn()
const mockIsProviderEnabled = vi.fn()

const { mockNodeDefsByName, mockPolicy, mockProviders, mockStatus } =
  vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
    const { ref } = require('vue') as typeof import('vue')
    return {
      mockNodeDefsByName: ref<Record<string, ComfyNodeDefImpl>>({}),
      mockPolicy: ref<PartnerNodePolicy | null>(null),
      mockProviders: ref<PartnerProvider[]>([]),
      mockStatus: ref('configured')
    }
  })

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/stores/partnerNodeGovernanceStore', () => ({
  usePartnerNodeGovernanceStore: () => ({
    policy: mockPolicy,
    providers: mockProviders,
    status: mockStatus,
    isProviderEnabled: mockIsProviderEnabled,
    loadPolicy: mockLoadPolicy
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ nodeDefsByName: mockNodeDefsByName })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      workspacePanel: {
        partnerNodes: {
          title: 'Partner node access',
          unrestricted: 'Unrestricted',
          restricted: 'Restricted',
          unrestrictedDescription:
            'Partner nodes from every provider are available.',
          restrictedDescription:
            'Only partner nodes from enabled providers are available.',
          searchPlaceholder: 'Search providers and partner nodes...',
          tableLabel: 'Partner node providers',
          columns: {
            provider: 'Provider / partner node',
            nodes: 'Nodes',
            enabled: 'Enabled'
          },
          nodeCount: '{count} node | {count} nodes',
          enabled: 'Enabled',
          disabled: 'Disabled',
          loading: 'Loading partner node access',
          loadError: "Partner node access couldn't be loaded.",
          retry: 'Try again',
          noResults: 'No providers or partner nodes found'
        }
      },
      g: { clear: 'Clear' }
    }
  }
})

function nodeDef(
  name: string,
  displayName: string,
  category: string
): ComfyNodeDefImpl {
  return {
    name,
    display_name: displayName,
    category,
    api_node: true
  } as ComfyNodeDefImpl
}

function renderComponent() {
  return render(PartnerNodeAccessPanel, {
    global: { plugins: [i18n] }
  })
}

describe('PartnerNodeAccessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus.value = 'configured'
    mockPolicy.value = null
    mockProviders.value = [
      {
        id: 'openai',
        displayName: 'OpenAI (inc. Sora)',
        nodeCategories: ['OpenAI', 'Sora']
      },
      {
        id: 'route-only',
        displayName: 'Route only',
        nodeCategories: []
      }
    ]
    mockNodeDefsByName.value = {
      ImageNode: nodeDef('ImageNode', 'Create image', 'partner/image/OpenAI'),
      VideoNode: nodeDef('VideoNode', 'Create video', 'partner/video/Sora')
    }
    mockIsProviderEnabled.mockReturnValue(true)
  })

  it('groups object-info nodes under visible catalog providers', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(screen.getByText('OpenAI (inc. Sora)')).toBeTruthy()
    expect(screen.getByText('2 nodes')).toBeTruthy()
    expect(screen.queryByText('Route only')).toBeNull()
    expect(screen.queryByText('Create image')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'OpenAI (inc. Sora)' }))

    expect(screen.getByText('Create image')).toBeTruthy()
    expect(screen.getByText('Create video')).toBeTruthy()
  })

  it('searches both provider and node names', async () => {
    const user = userEvent.setup()
    mockProviders.value = [
      ...mockProviders.value,
      {
        id: 'acme',
        displayName: 'Acme',
        nodeCategories: ['Acme']
      }
    ]
    mockNodeDefsByName.value.AcmeNode = nodeDef(
      'AcmeNode',
      'Enhance image',
      'partner/image/Acme'
    )
    renderComponent()

    await user.type(
      screen.getByRole('combobox', {
        name: 'Search providers and partner nodes...'
      }),
      'Enhance'
    )

    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('Enhance image')).toBeTruthy()
    expect(screen.queryByText('OpenAI (inc. Sora)')).toBeNull()
  })

  it('keeps name-matched providers without loaded nodes', async () => {
    const user = userEvent.setup()
    mockProviders.value = [
      ...mockProviders.value,
      {
        id: 'acme',
        displayName: 'Acme',
        nodeCategories: ['Acme']
      }
    ]
    renderComponent()
    const search = screen.getByRole('combobox', {
      name: 'Search providers and partner nodes...'
    })

    await user.type(search, 'Acme')

    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('0 nodes')).toBeTruthy()

    await user.clear(search)
    await user.type(search, 'Missing')

    expect(screen.getByText('No providers or partner nodes found')).toBeTruthy()
  })

  it('shows effective disabled state only while restricted', () => {
    mockPolicy.value = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    mockIsProviderEnabled.mockReturnValue(false)
    renderComponent()

    expect(screen.getByText('Restricted')).toBeTruthy()
    expect(screen.getByText('Disabled')).toBeTruthy()
  })

  it('retries a failed load', async () => {
    const user = userEvent.setup()
    mockStatus.value = 'error'
    renderComponent()

    expect(screen.queryByText('Unrestricted')).toBeNull()
    expect(
      screen.queryByText('Partner nodes from every provider are available.')
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(mockLoadPolicy).toHaveBeenCalledOnce()
  })
})
