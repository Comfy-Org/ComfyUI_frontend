import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { DownloadStatus } from '../types'
import ModelDownloadRow from './ModelDownloadRow.vue'

const mockPause = vi.fn()
const mockResume = vi.fn()
const mockCancel = vi.fn()
const mockRaisePriority = vi.fn()
const mockRemove = vi.fn()

vi.mock('../composables/useModelDownloadActions', () => ({
  useModelDownloadActions: () => ({
    pause: mockPause,
    resume: mockResume,
    cancel: mockCancel,
    raisePriority: mockRaisePriority,
    remove: mockRemove,
    toastError: vi.fn()
  })
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
  onOpenAuth?: (provider: string | undefined) => void
) {
  return render(ModelDownloadRow, {
    props: {
      download,
      ...(onOpenAuth ? { onOpenAuth } : {})
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

  describe('progress bar visibility', () => {
    it('shows a progress bar for an active download with known progress', () => {
      mountRow(createDownload({ status: 'active', progress: 0.5 }))

      expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
    })

    it('hides the progress bar for a cancelled download', () => {
      mountRow(createDownload({ status: 'cancelled', progress: 0.5 }))

      expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument()
      expect(screen.getByText('Cancelled')).toBeInTheDocument()
    })
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
      expect(
        screen.queryByTitle('Set up download access')
      ).not.toBeInTheDocument()
    })

    it('shows the remove action for terminal downloads', () => {
      mountRow(createDownload({ status: 'completed' }))

      expect(screen.getByTitle('Remove from list')).toBeInTheDocument()
      expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Resume')).not.toBeInTheDocument()
    })
  })

  describe('auth errors', () => {
    it('shows the auth button and a host-specific hint, emitting the provider', async () => {
      const onOpenAuth = vi.fn()
      mountRow(
        createDownload({
          status: 'failed',
          url: 'https://huggingface.co/org/x.safetensors',
          error: '401 Unauthorized'
        }),
        onOpenAuth
      )

      expect(
        screen.getByText(
          'huggingface.co needs authentication. Set up download access, then resume.'
        )
      ).toBeInTheDocument()

      await userEvent.click(screen.getByTitle('Set up download access'))
      expect(onOpenAuth).toHaveBeenCalledWith('huggingface')
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
          'This download needs authentication. Set up download access, then resume.'
        )
      ).toBeInTheDocument()
    })

    it('shows the raw error message for a non-auth failure', () => {
      mountRow(createDownload({ status: 'failed', error: 'disk full' }))

      expect(screen.getByText('disk full')).toBeInTheDocument()
      expect(
        screen.queryByTitle('Set up download access')
      ).not.toBeInTheDocument()
    })

    it('hides a leftover error while the download is not yet terminal', () => {
      mountRow(createDownload({ status: 'active', error: 'disk full' }))

      expect(screen.queryByText('disk full')).not.toBeInTheDocument()
    })
  })

  describe('gated models', () => {
    const gatedError =
      'https://huggingface.co/black-forest-labs/FLUX.2-dev/blob/main/vae/diffusion_pytorch_model.safetensors is a gated model — Access to model black-forest-labs/FLUX.2-dev is restricted. You must have access to it and be authenticated to access it.'

    it('shows the gated hint, auth button, and a link to accept the license on the model page', () => {
      mountRow(
        createDownload({
          status: 'failed',
          url: 'https://huggingface.co/black-forest-labs/FLUX.2-dev/blob/main/vae/diffusion_pytorch_model.safetensors',
          error: gatedError
        })
      )

      expect(
        screen.getByText(
          "This model is gated. Accept its license on the model's page, set up download access, then resume."
        )
      ).toBeInTheDocument()
      expect(screen.getByTitle('Set up download access')).toBeInTheDocument()

      const link = screen.getByRole('link', { name: 'Accept license' })
      expect(link).toHaveAttribute(
        'href',
        'https://huggingface.co/black-forest-labs/FLUX.2-dev'
      )
    })

    it('derives the model page from the error when the download url is a cdn link', () => {
      mountRow(
        createDownload({
          status: 'failed',
          url: 'https://cas-bridge.xethub.hf.co/xet-bridge-us/abc/def',
          error: gatedError
        })
      )

      expect(
        screen.getByRole('link', { name: 'Accept license' })
      ).toHaveAttribute(
        'href',
        'https://huggingface.co/black-forest-labs/FLUX.2-dev'
      )
    })

    it('hides the raw backend error text for gated failures', () => {
      mountRow(
        createDownload({
          status: 'failed',
          url: 'https://huggingface.co/black-forest-labs/FLUX.2-dev/blob/main/model.safetensors',
          error: gatedError
        })
      )

      expect(screen.queryByText(gatedError)).not.toBeInTheDocument()
    })

    it('shows the raw 404 message instead of the gated hint even though HF appends a generic gated-repo suggestion', () => {
      const notFoundError =
        '404 Client Error. (Request ID: abc123)\n\nRepository Not Found for url: https://huggingface.co/org/renamed-model/resolve/main/model.safetensors.\nPlease make sure you specified the correct `repo_id` and `repo_type`.\nIf you are trying to access a private or gated repo, make sure you are authenticated and your Access Token has the right permissions.'
      mountRow(
        createDownload({
          status: 'failed',
          url: 'https://huggingface.co/org/renamed-model/resolve/main/model.safetensors',
          error: notFoundError
        })
      )

      expect(
        screen.queryByText(
          "This model is gated. Accept its license on the model's page, set up download access, then resume."
        )
      ).not.toBeInTheDocument()
      expect(screen.getByText(notFoundError)).toBeInTheDocument()
    })

    it('omits the accept-license link when no huggingface url is present', () => {
      mountRow(
        createDownload({
          status: 'failed',
          url: 'https://example.com/model.safetensors',
          error: 'Access to this model is restricted, request access.'
        })
      )

      expect(
        screen.queryByRole('link', { name: 'Accept license' })
      ).not.toBeInTheDocument()
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

    it('removes the download on click', async () => {
      const download = createDownload({
        download_id: 'd1',
        status: 'completed'
      })
      mountRow(download)

      await userEvent.click(screen.getByTitle('Remove from list'))
      expect(mockRemove).toHaveBeenCalledWith(download)
    })
  })
})
