import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type * as ModelDownloadStoreModule from '../stores/modelDownloadStore'
import type { DownloadStatus } from '../types'
import ModelDownloadRow from './ModelDownloadRow.vue'

const mockPause = vi.fn()
const mockResume = vi.fn()
const mockCancel = vi.fn()
const mockRaisePriority = vi.fn()
const mockRemoveFromView = vi.fn()

vi.mock('../composables/useModelDownloadActions', () => ({
  useModelDownloadActions: () => ({
    pause: mockPause,
    resume: mockResume,
    cancel: mockCancel,
    raisePriority: mockRaisePriority,
    toastError: vi.fn()
  })
}))

vi.mock('../stores/modelDownloadStore', async (importOriginal) => {
  const actual = await importOriginal<typeof ModelDownloadStoreModule>()
  return {
    ...actual,
    useModelDownloadStore: () => ({ removeFromView: mockRemoveFromView })
  }
})

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
    total_bytes: 2048,
    bytes_done: 1024,
    progress: 0.5,
    speed_bps: 512,
    eta_seconds: 125,
    segments: null,
    error: null,
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

function mountRow(
  download: DownloadStatus,
  onOpenCredentials?: (host: string) => void
) {
  return render(ModelDownloadRow, {
    props: {
      download,
      ...(onOpenCredentials ? { onOpenCredentials } : {})
    },
    global: { plugins: [i18n] }
  })
}

describe('ModelDownloadRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('splits the model id into directory and filename', () => {
    mountRow(createDownload({ model_id: 'loras/x.safetensors' }))

    expect(screen.getByText('x.safetensors')).toBeInTheDocument()
    expect(screen.getByText('loras')).toBeInTheDocument()
  })

  it('renders an empty directory when the model id has no folder', () => {
    mountRow(createDownload({ model_id: 'x.safetensors' }))

    expect(screen.getByText('x.safetensors')).toBeInTheDocument()
  })

  it('formats the meta line with percent, size, speed, and eta while active', () => {
    mountRow(createDownload({ status: 'active' }))

    expect(
      screen.getByText('50% · 1 KB / 2 KB · 512 B/s · 2:05')
    ).toBeInTheDocument()
  })

  it('renders an empty meta line when no progress metrics are known yet', () => {
    mountRow(
      createDownload({
        status: 'queued',
        progress: null,
        total_bytes: null,
        bytes_done: 0,
        speed_bps: null,
        eta_seconds: null
      })
    )

    expect(screen.getByTestId('meta-line')).toBeEmptyDOMElement()
  })

  it('omits the eta once a download is no longer active', () => {
    mountRow(
      createDownload({
        status: 'paused',
        progress: 0.5,
        eta_seconds: 125
      })
    )

    expect(screen.getByText('50% · 1 KB / 2 KB · 512 B/s')).toBeInTheDocument()
  })

  describe('action buttons by status', () => {
    it('shows pause and cancel for a queued download, plus raise priority', () => {
      mountRow(createDownload({ status: 'queued' }))

      expect(screen.getByTitle('Raise priority')).toBeInTheDocument()
      expect(screen.getByTitle('Pause')).toBeInTheDocument()
      expect(screen.getByTitle('Cancel')).toBeInTheDocument()
      expect(screen.queryByTitle('Resume')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Remove from list')).not.toBeInTheDocument()
    })

    it('shows only resume for a failed download without an auth error', () => {
      mountRow(createDownload({ status: 'failed', error: 'disk full' }))

      expect(screen.getByTitle('Resume')).toBeInTheDocument()
      expect(screen.queryByTitle('Pause')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Remove from list')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Add credentials')).not.toBeInTheDocument()
    })

    it('shows the remove action for terminal downloads', () => {
      mountRow(createDownload({ status: 'completed' }))

      expect(screen.getByTitle('Remove from list')).toBeInTheDocument()
      expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Resume')).not.toBeInTheDocument()
    })
  })

  describe('auth errors', () => {
    it('shows the credentials button and a host-specific hint', async () => {
      const onOpenCredentials = vi.fn()
      mountRow(
        createDownload({
          status: 'failed',
          url: 'https://huggingface.co/org/x.safetensors',
          error: '401 Unauthorized'
        }),
        onOpenCredentials
      )

      expect(
        screen.getByText(
          'huggingface.co needs an API key. Add one in the Credentials Manager, then resume.'
        )
      ).toBeInTheDocument()

      await userEvent.click(screen.getByTitle('Add credentials'))
      expect(onOpenCredentials).toHaveBeenCalledWith('huggingface.co')
    })

    it('falls back to a hostless hint when the url cannot be parsed', () => {
      mountRow(
        createDownload({
          status: 'failed',
          url: 'not-a-url',
          error: '403 forbidden'
        })
      )

      expect(
        screen.getByText(
          'This host/model needs an API key. Add one in the Credentials Manager, then resume.'
        )
      ).toBeInTheDocument()
    })

    it('shows the raw error message for a non-auth failure', () => {
      mountRow(createDownload({ status: 'failed', error: 'disk full' }))

      expect(screen.getByText('disk full')).toBeInTheDocument()
      expect(screen.queryByTitle('Add credentials')).not.toBeInTheDocument()
    })
  })

  describe('user actions', () => {
    it('pauses on click', async () => {
      const download = createDownload({ status: 'active' })
      mountRow(download)

      await userEvent.click(screen.getByTitle('Pause'))
      expect(mockPause).toHaveBeenCalledWith(download)
    })

    it('resumes on click', async () => {
      const download = createDownload({ status: 'paused' })
      mountRow(download)

      await userEvent.click(screen.getByTitle('Resume'))
      expect(mockResume).toHaveBeenCalledWith(download)
    })

    it('cancels on click', async () => {
      const download = createDownload({ status: 'active' })
      mountRow(download)

      await userEvent.click(screen.getByTitle('Cancel'))
      expect(mockCancel).toHaveBeenCalledWith(download)
    })

    it('raises priority by 1 on click', async () => {
      const download = createDownload({ status: 'queued', priority: 2 })
      mountRow(download)

      await userEvent.click(screen.getByTitle('Raise priority'))
      expect(mockRaisePriority).toHaveBeenCalledWith(download, 1)
    })

    it('removes from view on click', async () => {
      mountRow(createDownload({ download_id: 'd1', status: 'completed' }))

      await userEvent.click(screen.getByTitle('Remove from list'))
      expect(mockRemoveFromView).toHaveBeenCalledWith('d1')
    })
  })
})
