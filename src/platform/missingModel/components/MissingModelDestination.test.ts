import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import MissingModelDestination from '@/platform/missingModel/components/MissingModelDestination.vue'

const mockIsLocal = vi.hoisted(() => ({ value: true }))
const mockFolderPaths = vi.hoisted(() => ({
  value: {} as Record<string, string[]>
}))
const mockCopyToClipboard = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: mockCopyToClipboard })
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  isLocalHost: () => mockIsLocal.value
}))

vi.mock('@/platform/missingModel/missingModelStore', () => ({
  useMissingModelStore: () => ({ folderPaths: mockFolderPaths.value })
}))

function renderDestination(props: {
  directory: string
  downloadTriggered?: boolean
}) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(MissingModelDestination, {
    props,
    global: { plugins: [i18n] }
  })
}

beforeEach(() => {
  mockIsLocal.value = true
  mockFolderPaths.value = {}
  mockCopyToClipboard.mockClear()
})

describe('MissingModelDestination', () => {
  it('shows the destination path and copies the full path on a local install', async () => {
    mockFolderPaths.value = { loras: ['/home/user/ComfyUI/models/loras'] }

    renderDestination({ directory: 'loras' })

    expect(screen.getByText('Place this file in:')).toBeInTheDocument()
    expect(screen.getByText('…/models/loras/')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('missing-model-copy-path'))
    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      '/home/user/ComfyUI/models/loras'
    )
  })

  it('shows the remote-server transfer notice when not served from localhost', () => {
    mockIsLocal.value = false
    mockFolderPaths.value = { loras: ['/srv/ComfyUI/models/loras'] }

    renderDestination({ directory: 'loras' })

    expect(screen.getByText(/running on a remote server/i)).toBeInTheDocument()
    expect(screen.queryByText('Place this file in:')).not.toBeInTheDocument()
  })

  it('falls back to a default relative path with no copy button when the folder is unknown', () => {
    mockFolderPaths.value = {}

    renderDestination({ directory: 'diffusion_models' })

    expect(screen.getByText('models/diffusion_models/')).toBeInTheDocument()
    expect(
      screen.queryByTestId('missing-model-copy-path')
    ).not.toBeInTheDocument()
  })

  it('reveals additional configured folders behind a toggle', async () => {
    mockFolderPaths.value = {
      text_encoders: [
        '/home/user/ComfyUI/models/text_encoders',
        '/mnt/extra/models/clip'
      ]
    }

    renderDestination({ directory: 'text_encoders' })

    const toggle = screen.getByTestId('missing-model-more-folders')
    expect(toggle).toHaveTextContent('+1 more folder')

    await userEvent.click(toggle)
    expect(toggle).toHaveTextContent('Hide extra folders')
  })

  it('shows the post-download move instruction once a download has been triggered', () => {
    mockFolderPaths.value = { loras: ['/home/user/ComfyUI/models/loras'] }

    renderDestination({ directory: 'loras', downloadTriggered: true })

    expect(
      screen.getByText(/move the file to the folder above/i)
    ).toBeInTheDocument()
  })
})
