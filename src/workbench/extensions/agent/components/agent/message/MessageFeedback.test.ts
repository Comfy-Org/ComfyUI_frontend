// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { i18n } from '@/i18n'

import type { ReplyAsset } from '../../../utils/replyAssets'
import MessageFeedback from './MessageFeedback.vue'

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (route: string) => '/api' + route,
    fetchApi
  }
}))

vi.mock('@/platform/assets/utils/assetPreviewUtil', () => ({
  isAssetPreviewSupported: () => false,
  findOutputAsset: async () => undefined
}))

vi.mock('@vueuse/core', () => ({
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
    clipboard.copy.mockClear()
    fetchApi.mockReset()
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
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const { user } = renderFeedback([
      { url: 'https://x/a.png', filename: 'a.png', kind: 'image' },
      { url: 'https://x/mesh.glb', filename: 'mesh.glb', kind: '3D' }
    ])

    await user.click(screen.getByRole('button', { name: 'Download assets' }))

    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(2))
    expect(fetchApi).toHaveBeenCalledWith('https://x/a.png')
    expect(fetchApi).toHaveBeenCalledWith('https://x/mesh.glb')
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledTimes(2))
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
