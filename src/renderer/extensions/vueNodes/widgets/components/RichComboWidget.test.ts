import { createTestingPinia } from '@pinia/testing'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import axios from 'axios'
import type * as AxiosModule from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import RichComboWidget from '@/renderer/extensions/vueNodes/widgets/components/RichComboWidget.vue'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  RemoteComboConfig,
  RemoteItemSchema
} from '@/schemas/nodeDefSchema'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { createMockWidget } from './widgetTestUtils'

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof AxiosModule>()
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() }
  }
})

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ currentWorkspace: null })
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    userId: undefined,
    getAuthHeader: vi.fn(() => Promise.resolve(null))
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      widgets: {
        remoteCombo: {
          loading: 'Loading...',
          loadFailed: 'Failed to load options',
          noResults: 'No results found',
          refresh: 'Refresh options',
          searchAriaLabel: 'Search {field}',
          layoutSwitcherAriaLabel: 'Layout switcher',
          layoutList: 'List view',
          layoutGrid: 'Grid view'
        },
        uploadSelect: { placeholder: 'Select...' }
      },
      g: { search: 'Search' }
    }
  }
})

function makeWidget(
  spec: ComboInputSpec,
  value: string | undefined = undefined
): SimplifiedWidget<string | undefined> {
  return createMockWidget({
    name: 'remote_field',
    type: 'combo',
    value,
    spec
  })
}

const itemSchema: RemoteItemSchema = {
  value_field: 'id',
  label_field: 'name',
  preview_type: 'image'
}

function makeRemoteCombo(
  overrides: Partial<RemoteComboConfig> = {}
): ComboInputSpec {
  return {
    name: 'remote_field',
    type: 'COMBO',
    isOptional: false,
    remote_combo: {
      route: '/test/options',
      item_schema: itemSchema,
      ...overrides
    }
  }
}

function renderWithProviders(
  component: typeof RichComboWidget,
  props: { widget: SimplifiedWidget<string | undefined> }
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(component, {
    global: {
      plugins: [
        i18n,
        createTestingPinia({ createSpy: vi.fn }),
        [VueQueryPlugin, { queryClient }]
      ]
    },
    props
  })
}

beforeEach(() => {
  vi.mocked(axios.get).mockReset()
})

describe('RichComboWidget', () => {
  it('renders trigger with placeholder when no selection and no items loaded', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [], status: 200 })
    const widget = makeWidget(makeRemoteCombo())
    renderWithProviders(RichComboWidget, { widget })
    await waitFor(() =>
      expect(screen.getByTestId('remote-combo-trigger')).toHaveTextContent(
        'Select...'
      )
    )
  })

  it('shows loading state while fetching', async () => {
    let resolveResp: (value: unknown) => void = () => {}
    vi.mocked(axios.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveResp = (data) => resolve({ data, status: 200 })
        })
    )
    const widget = makeWidget(makeRemoteCombo())
    renderWithProviders(RichComboWidget, { widget })
    const trigger = await screen.findByTestId('remote-combo-trigger')
    expect(trigger).toHaveTextContent(/loading/i)
    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    resolveResp([])
  })

  it('auto_select="first" selects first item when value is empty', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        { id: 'one', name: 'One' },
        { id: 'two', name: 'Two' }
      ],
      status: 200
    })
    const widget = makeWidget(makeRemoteCombo({ auto_select: 'first' }))
    const { emitted } = renderWithProviders(RichComboWidget, { widget })
    await waitFor(() => {
      const events = emitted<unknown[]>('update:modelValue')
      expect(events?.[0]?.[0]).toBe('one')
    })
  })

  it('excludes remote items without an id', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [{ name: 'Missing ID' }, { id: 'valid', name: 'Valid' }],
      status: 200
    })
    const widget = makeWidget(makeRemoteCombo({ auto_select: 'first' }))
    const { emitted } = renderWithProviders(RichComboWidget, { widget })
    await waitFor(() => {
      const events = emitted<unknown[]>('update:modelValue')
      expect(events?.[0]?.[0]).toBe('valid')
    })
  })

  it('auto_select="last" selects last item when value is empty', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' }
      ],
      status: 200
    })
    const widget = makeWidget(makeRemoteCombo({ auto_select: 'last' }))
    const { emitted } = renderWithProviders(RichComboWidget, { widget })
    await waitFor(() => {
      const events = emitted<unknown[]>('update:modelValue')
      expect(events?.[0]?.[0]).toBe('c')
    })
  })

  it('searches the displayed id when an item name is empty', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        { id: 'fallback-id', name: '' },
        { id: 'other', name: 'Other' }
      ],
      status: 200
    })
    const widget = makeWidget(makeRemoteCombo())
    renderWithProviders(RichComboWidget, { widget })

    const trigger = screen.getByTestId('remote-combo-trigger')
    await waitFor(() => expect(trigger).toHaveTextContent('Select...'))
    await userEvent.click(trigger)
    await userEvent.type(
      await screen.findByTestId('remote-combo-search-input'),
      'fallback-id'
    )

    expect(await screen.findByText('fallback-id')).toBeInTheDocument()
    expect(screen.queryByText('Other')).toBeNull()
  })

  it('renders refresh button when refresh_button is undefined', () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [], status: 200 })
    const widget = makeWidget(makeRemoteCombo())
    renderWithProviders(RichComboWidget, { widget })
    expect(screen.getByTestId('remote-combo-refresh')).toBeInTheDocument()
  })

  it('hides refresh button when refresh_button is false', () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [], status: 200 })
    const widget = makeWidget(makeRemoteCombo({ refresh_button: false }))
    renderWithProviders(RichComboWidget, { widget })
    expect(screen.queryByTestId('remote-combo-refresh')).toBeNull()
  })
})
