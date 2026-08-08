// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import MessageFeedback from './MessageFeedback.vue'

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }))

vi.mock('@vueuse/core', async (importOriginal) => {
  const { ref } = await import('vue')
  return {
    ...(await importOriginal<object>()),
    useClipboard: () => ({
      copy: clipboard.copy,
      copied: ref(false),
      isSupported: ref(true),
      text: ref('')
    })
  }
})

const markdownSource = '# Title\n\n**bold** move'

function renderFeedback() {
  const user = userEvent.setup()
  const utils = render(MessageFeedback, {
    props: { markdown: markdownSource },
    global: { plugins: [i18n] }
  })
  return { user, ...utils }
}

describe('MessageFeedback', () => {
  beforeEach(() => {
    clipboard.copy.mockClear()
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

  it('Escape closes the markdown menu without copying', async () => {
    const { user } = renderFeedback()

    await user.click(screen.getByRole('button', { name: 'Copy as markdown' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(clipboard.copy).not.toHaveBeenCalled()
  })
})
