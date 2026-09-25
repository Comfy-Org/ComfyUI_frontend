import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'

import type { ReplyAsset } from '../../../utils/replyAssets'
import MessageFeedback from './MessageFeedback.vue'

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

vi.mock(import('@/scripts/api'))

vi.mock(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  isAssetPreviewSupported: () => false,
  findOutputAsset: async () => undefined
}))

vi.mock<unknown>(import('@vueuse/core'), () => ({
  useClipboard: () => ({
    copy: clipboard.copy,
    copied: ref(false),
    isSupported: ref(true),
    text: ref('')
  })
}))

const markdownSource = '# Title\n\n**bold** move'

function renderFeedback(assets?: ReplyAsset[]) {
  const user = userEvent.setup()
  const utils = render(MessageFeedback, {
    props: { markdown: markdownSource, assets },
    global: { plugins: [i18n] }
  })
  return { user, ...utils }
}

describe('MessageFeedback', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((route) => '/api' + route)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    clipboard.copy.mockClear()
    vi.mocked(api.fetchApi).mockReset()
  })

  it('emits the vote, then null when the same vote is clicked again', async () => {
    const { user, emitted } = renderFeedback()
    const up = screen.getByRole('button', { name: 'Helpful' })

    await user.click(up)
    expect(up).toHaveAttribute('aria-pressed', 'true')

    await user.click(up)
    expect(up).toHaveAttribute('aria-pressed', 'false')

    expect(emitted('feedback')).toEqual([['up'], [null]])
  })

  it('switching votes emits the new vote and moves the pressed state', async () => {
    const { user, emitted } = renderFeedback()

    await user.click(screen.getByRole('button', { name: 'Helpful' }))
    await user.click(screen.getByRole('button', { name: 'Not helpful' }))

    expect(emitted('feedback')).toEqual([['up'], ['down']])
    expect(screen.getByRole('button', { name: 'Helpful' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: 'Not helpful' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it.for(['Helpful', 'Not helpful', 'Copy'])(
    'shows a tooltip for the %s action',
    async (label) => {
      const { user } = renderFeedback()
      const action = screen.getByRole('button', { name: label })

      await user.hover(action)

      expect(
        await screen.findByRole('tooltip', { hidden: true })
      ).toHaveTextContent(label)
    }
  )

  it('the primary Copy action copies rendered plain text without opening a menu', async () => {
    const { user } = renderFeedback()

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(clipboard.copy).toHaveBeenCalledWith('Title\nbold move')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('the chevron menu exposes only Copy as markdown and copies the raw source', async () => {
    const { user } = renderFeedback()

    await user.click(screen.getByRole('button', { name: 'Copy as markdown' }))
    const menu = await screen.findByRole('menu')
    const menuItems = within(menu).getAllByRole('menuitem')

    expect(menuItems).toHaveLength(1)
    expect(menuItems[0]).toHaveAccessibleName('Copy as markdown')

    await user.click(menuItems[0])

    expect(clipboard.copy).toHaveBeenCalledWith(markdownSource)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('hides the download action when the reply has no assets', () => {
    renderFeedback()

    expect(
      screen.queryByRole('button', { name: 'Download assets' })
    ).not.toBeInTheDocument()
  })

  it('downloads every reply asset from the download action', async () => {
    vi.mocked(api.fetchApi).mockImplementation(
      async () => new Response(new Blob(['x']))
    )
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const { user } = renderFeedback([
      { url: 'https://x/a.png', filename: 'a.png', kind: 'image' },
      { url: 'https://x/mesh.glb', filename: 'mesh.glb', kind: '3D' }
    ])

    await user.click(screen.getByRole('button', { name: 'Download assets' }))

    await waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(2))
    expect(api.fetchApi).toHaveBeenCalledWith('https://x/a.png')
    expect(api.fetchApi).toHaveBeenCalledWith('https://x/mesh.glb')
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledTimes(2))
  })

  it('reports failed files without blocking successful downloads or retry', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(new Response(new Blob(['x'])))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockImplementation(async () => new Response(new Blob(['retry'])))
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    const { user } = renderFeedback([
      { url: 'https://x/a.png', filename: 'a.png', kind: 'image' },
      { url: 'https://x/b.png', filename: 'b.png', kind: 'image' }
    ])
    const download = screen.getByRole('button', { name: 'Download assets' })

    await user.click(download)

    await waitFor(() =>
      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: '1 download failed'
        })
      )
    )
    await waitFor(() => expect(download).toBeEnabled())

    await user.click(download)

    await waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(4))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(3))
    expect(revokeObjectURL).toHaveBeenCalledTimes(3)
  })

  it('Escape closes the markdown menu without copying', async () => {
    const { user } = renderFeedback()

    await user.click(screen.getByRole('button', { name: 'Copy as markdown' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(clipboard.copy).not.toHaveBeenCalled()
  })
})
