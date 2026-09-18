import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { i18n } from '@/i18n'

import type { ReplyAsset } from '../../../utils/replyAssets'
import MessageFeedback from './MessageFeedback.vue'

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    apiURL: (route: string) => '/api' + route,
    fetchApi
  }
}))

// Mock the download sink the way ReplyAudioCard.test.ts in this folder does.
// The real one appends an <a href="blob:..."> and clicks it, which this DOM
// treats as a navigation: window.location.origin becomes "null", so the next
// `new URL(path, origin)` throws Invalid URL. That is why the second of two
// downloads failed while the first succeeded.
const downloadBlob = vi.hoisted(() => vi.fn())
vi.mock(import('@/base/common/downloadUtil'), () => ({ downloadBlob }))

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
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    clipboard.copy.mockClear()
    fetchApi.mockReset()
    downloadBlob.mockClear()
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
    fetchApi.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['x']))
    })
    // Reply assets the backend serves live on the API's own view route.
    // Only those go through the authenticated client; downloadReplyAsset
    // sends anything else through a plain fetch, so asserting foreign URLs
    // here would be asserting a credential leak.
    const origin = window.location.origin
    const { user } = renderFeedback([
      {
        url: `${origin}/api/view?filename=a.png`,
        filename: 'a.png',
        kind: 'image'
      },
      {
        url: `${origin}/api/view?filename=mesh.glb`,
        filename: 'mesh.glb',
        kind: '3D'
      }
    ])

    const download = screen.getByRole('button', { name: 'Download assets' })
    await user.click(download)

    // The button is disabled for the whole sequential loop and re-enabled in
    // its `finally`, so waiting on that is the end-of-run signal. Polling the
    // call count instead races the second download and reports 1 of 2 on a
    // slow runner.
    await waitFor(() => expect(download).toBeEnabled())

    // Belt and braces: if the disabled state is ever dropped, the wait above
    // becomes a no-op, so the count keeps its own bounded retry rather than
    // silently going back to racing the second download. Kept well inside the
    // test budget below — a retry as long as the budget just turns a slow run
    // into a timeout instead of a wait.
    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(2), {
      timeout: 2000
    })
    expect(fetchApi).toHaveBeenCalledWith('/view?filename=a.png')
    expect(fetchApi).toHaveBeenCalledWith('/view?filename=mesh.glb')
    expect(downloadBlob).toHaveBeenCalledWith('a.png', expect.any(Blob))
    expect(downloadBlob).toHaveBeenCalledWith('mesh.glb', expect.any(Blob))
    // Two sequential downloads through the component, under coverage
    // instrumentation on a shared runner, do not reliably fit the 5s default.
  }, 20_000)

  it('Escape closes the markdown menu without copying', async () => {
    const { user } = renderFeedback()

    await user.click(screen.getByRole('button', { name: 'Copy as markdown' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(clipboard.copy).not.toHaveBeenCalled()
  })
})
