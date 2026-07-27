import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { DownloadStatus } from '../types'
import ModelManagerSidebarTab from './ModelManagerSidebarTab.vue'

const mockHydrate = vi.fn()
const mockClearHistory = vi.fn()

const mockStore = reactive({
  downloadList: ref<DownloadStatus[]>([]),
  activeDownloads: ref<DownloadStatus[]>([]),
  historyDownloads: ref<DownloadStatus[]>([]),
  hydrate: mockHydrate
})

vi.mock('../stores/modelDownloadStore', () => ({
  useModelDownloadStore: () => mockStore
}))

vi.mock('../composables/useModelDownloadActions', () => ({
  useModelDownloadActions: () => ({ clearHistory: mockClearHistory })
}))

vi.mock('./ModelDownloadRow.vue', () => ({
  default: {
    name: 'ModelDownloadRow',
    props: ['download'],
    emits: ['openAuth'],
    template:
      '<div><span>{{ download.download_id }}</span>' +
      "<button @click=\"$emit('openAuth', 'huggingface')\">open-auth</button></div>"
  }
}))

vi.mock('./AddModelByUrlDialog.vue', () => ({
  default: {
    name: 'AddModelByUrlDialog',
    props: ['open'],
    emits: ['authRequired'],
    template: '<div data-testid="add-model-dialog">{{ open }}</div>'
  }
}))

vi.mock('./DownloadAuthDialog.vue', () => ({
  default: {
    name: 'DownloadAuthDialog',
    props: ['open', 'focusProvider'],
    template:
      '<div data-testid="auth-dialog">{{ open }}:{{ focusProvider }}</div>'
  }
}))

vi.mock('@/components/sidebar/tabs/SidebarTabTemplate.vue', () => ({
  default: {
    name: 'SidebarTabTemplate',
    template: '<div><slot name="tool-buttons" /><slot name="body" /></div>'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

function createDownload(
  overrides: Partial<DownloadStatus> = {}
): DownloadStatus {
  return {
    download_id: 'd1',
    model_id: 'loras/x.safetensors',
    url: 'https://huggingface.co/org/x.safetensors',
    status: 'active',
    priority: 0,
    total_bytes: null,
    bytes_done: 0,
    progress: null,
    speed_bps: null,
    eta_seconds: null,
    segments: null,
    error: null,
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

function mountTab() {
  return render(ModelManagerSidebarTab, { global: { plugins: [i18n] } })
}

describe('ModelManagerSidebarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.downloadList = []
    mockStore.activeDownloads = []
    mockStore.historyDownloads = []
  })

  it('hydrates the store on mount', () => {
    mountTab()
    expect(mockHydrate).toHaveBeenCalled()
  })

  it('shows the empty state when there are no downloads', () => {
    mountTab()
    expect(screen.getByText('No downloads yet')).toBeInTheDocument()
  })

  it('renders active downloads under the Active section', () => {
    const download = createDownload({ download_id: 'd1' })
    mockStore.activeDownloads = [download]
    mockStore.downloadList = [download]
    mountTab()

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('d1')).toBeInTheDocument()
    expect(screen.queryByText('No downloads yet')).not.toBeInTheDocument()
  })

  it('renders history downloads under the History section with a clear action', async () => {
    const download = createDownload({ download_id: 'd2' })
    mockStore.historyDownloads = [download]
    mockStore.downloadList = [download]
    mountTab()

    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText('d2')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Clear history'))
    expect(mockClearHistory).toHaveBeenCalled()
  })

  it('opens the add-model dialog from the toolbar button', async () => {
    mountTab()

    expect(screen.getByTestId('add-model-dialog')).toHaveTextContent('false')
    await userEvent.click(screen.getByTitle('Add model'))
    expect(screen.getByTestId('add-model-dialog')).toHaveTextContent('true')
  })

  it('opens the add-model dialog from the empty state button', async () => {
    mountTab()

    await userEvent.click(screen.getByText('Add model'))
    expect(screen.getByTestId('add-model-dialog')).toHaveTextContent('true')
  })

  it('opens the download-auth dialog with no focused provider from the toolbar button', async () => {
    mountTab()

    await userEvent.click(screen.getByTitle('Download access'))
    expect(screen.getByTestId('auth-dialog')).toHaveTextContent('true:')
  })

  it('opens the download-auth dialog focused on the row provider', async () => {
    const download = createDownload({
      download_id: 'd1',
      model_id: 'loras/x.safetensors'
    })
    mockStore.activeDownloads = [download]
    mockStore.downloadList = [download]
    mountTab()

    await userEvent.click(screen.getByText('open-auth'))

    expect(screen.getByTestId('auth-dialog')).toHaveTextContent(
      'true:huggingface'
    )
  })
})
