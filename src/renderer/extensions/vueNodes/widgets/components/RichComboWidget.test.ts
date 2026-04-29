import { createTestingPinia } from '@pinia/testing'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import axios, { AxiosError, AxiosHeaders } from 'axios'
import type * as AxiosModule from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import RichComboWidget from '@/renderer/extensions/vueNodes/widgets/components/RichComboWidget.vue'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  RemoteComboConfig,
  RemoteItemSchema
} from '@/schemas/nodeDefSchema'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { createMockWidget } from './widgetTestUtils'

// Preserve everything axios exports — only `default.get` is the call site we
// drive. Other modules in the import graph (e.g. workspaceApi) call
// axios.create() at module-load time, so we can't replace the default outright.
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof AxiosModule>()
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() }
  }
})

// All four auth-related composables are mocked at module level so the SFC's
// imports never pull in firebase / vuefire. Their return shapes only need to
// satisfy the call sites the widget actually hits.
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: { teamWorkspacesEnabled: false } })
}))
vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ currentWorkspace: null })
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    userId: undefined,
    getAuthHeader: vi.fn(() => Promise.resolve(null))
  })
}))
vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => ({ getApiKey: () => null })
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

// Minimal stub: surfaces the props the widget binds (so we can assert on them)
// and exposes click affordances that emit `update:selected` for the user-action
// tests. The real FormDropdown's rendering is tested in its own suite.
const FormDropdownStub = {
  name: 'FormDropdown',
  props: [
    'selected',
    'items',
    'placeholder',
    'multiple',
    'showSort',
    'showLayoutSwitcher',
    'searcher',
    'layoutMode'
  ],
  emits: ['update:selected', 'update:layoutMode'],
  template: `
    <div data-testid="dropdown">
      <span data-testid="placeholder">{{ placeholder }}</span>
      <span data-testid="items-count">{{ items.length }}</span>
      <button
        v-for="item in items"
        :key="item.id"
        :data-testid="'item-' + item.id"
        @click="$emit('update:selected', new Set([item.id]))"
      >
        {{ item.name }}
      </button>
      <button
        data-testid="deselect"
        @click="$emit('update:selected', new Set())"
      >×</button>
    </div>
  `
}

const baseSchema: RemoteItemSchema = {
  value_field: 'id',
  label_field: 'name',
  preview_type: 'image'
}

function buildWidget(
  remoteCombo: Partial<Omit<RemoteComboConfig, 'route' | 'item_schema'>> = {},
  value: string | undefined = undefined
): SimplifiedWidget<string | undefined> {
  const spec: ComboInputSpec = {
    type: 'COMBO',
    name: 'voice',
    remote_combo: {
      route: '/voices',
      item_schema: baseSchema,
      ...remoteCombo
    }
  }
  return createMockWidget<string | undefined>({
    name: 'voice',
    type: 'COMBO',
    value,
    spec
  })
}

function renderWidget(
  widget: SimplifiedWidget<string | undefined>,
  modelValue: string | undefined = undefined
) {
  return render(RichComboWidget, {
    props: {
      widget,
      modelValue: modelValue ?? widget.value
    },
    global: {
      plugins: [createTestingPinia(), i18n],
      stubs: { FormDropdown: FormDropdownStub }
    }
  })
}

function mockAxiosResponseOnce(data: unknown) {
  vi.mocked(axios.get).mockResolvedValueOnce({ data })
}

function mockAxiosErrorOnce(status: number) {
  vi.mocked(axios.get).mockRejectedValueOnce(
    new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', undefined, undefined, {
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: null
    })
  )
}

function mockAxiosNetworkErrorOnce() {
  vi.mocked(axios.get).mockRejectedValueOnce(
    new AxiosError('Network Error', 'ERR_NETWORK')
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Cache API isn't in happy-dom by default. Stub a no-op cache so getCached
  // always returns null (forces a fetch) and setCache/clearCache resolve.
  vi.stubGlobal('caches', {
    open: vi.fn(() =>
      Promise.resolve({
        match: vi.fn(() => Promise.resolve(undefined)),
        put: vi.fn(() => Promise.resolve()),
        delete: vi.fn(() => Promise.resolve(true))
      })
    )
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RichComboWidget', () => {
  it('mounts, fetches, and renders the items returned from the route', async () => {
    mockAxiosResponseOnce([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' }
    ])

    renderWidget(buildWidget())

    await waitFor(() =>
      expect(screen.getByTestId('items-count').textContent).toBe('2')
    )
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
  })

  it('shows the load-failed placeholder on a non-retriable 404 without retrying', async () => {
    mockAxiosErrorOnce(404)

    renderWidget(buildWidget())

    await waitFor(() =>
      expect(screen.getByTestId('placeholder').textContent).toBe(
        'widgets.remoteCombo.loadFailed'
      )
    )
    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
  })

  it('shows the load-failed placeholder when retries are exhausted', async () => {
    // max_retries=1 lets us assert exhaustion without sleeping through the
    // exponential backoff (`attempts++` then `attempts >= maxRetries` breaks
    // before any setTimeout call).
    mockAxiosNetworkErrorOnce()

    renderWidget(buildWidget({ max_retries: 1 }))

    await waitFor(() =>
      expect(screen.getByTestId('placeholder').textContent).toBe(
        'widgets.remoteCombo.loadFailed'
      )
    )
    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
  })

  it('refetches when the refresh button is clicked', async () => {
    mockAxiosResponseOnce([{ id: 'a', name: 'Alice' }])

    renderWidget(buildWidget())

    await waitFor(() =>
      expect(screen.getByTestId('items-count').textContent).toBe('1')
    )

    mockAxiosResponseOnce([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' }
    ])
    await userEvent.click(screen.getByLabelText('g.refresh'))

    await waitFor(() =>
      expect(screen.getByTestId('items-count').textContent).toBe('2')
    )
    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2)
  })

  it('clears modelValue to undefined when the selected item is toggled off (B1 regression)', async () => {
    mockAxiosResponseOnce([{ id: 'a', name: 'Alice' }])

    const { emitted } = renderWidget(buildWidget(), 'a')

    expect(await screen.findByTestId('item-a')).toBeTruthy()

    await userEvent.click(screen.getByTestId('deselect'))

    const updates = emitted('update:modelValue')
    expect(updates).toBeTruthy()
    expect(updates!.at(-1)).toEqual([undefined])
  })

  it('preserves a stale modelValue when the fetched items do not contain that id', async () => {
    mockAxiosResponseOnce([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' }
    ])

    const { emitted } = renderWidget(buildWidget(), 'stale-id')

    await waitFor(() =>
      expect(screen.getByTestId('items-count').textContent).toBe('2')
    )

    // The selection sync watcher only mutates the internal selectedSet — it
    // never writes to modelValue, so the stale id round-trips intact when the
    // workflow is later saved.
    expect(emitted('update:modelValue')).toBeFalsy()
    expect(screen.getByTestId('placeholder').textContent).toBe(
      'widgets.uploadSelect.placeholder'
    )
  })
})
