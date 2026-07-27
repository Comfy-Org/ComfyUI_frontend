import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import Composer from './Composer.vue'

function mount(props: ComponentProps<typeof Composer> = {}) {
  return render(Composer, { props, global: { plugins: [i18n] } })
}

describe('Composer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('disables send when empty and enables once text is typed', async () => {
    mount()
    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), 'hello')
    expect(send).toBeEnabled()
  })

  it('renders without vue-i18n message compilation errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mount({ canAttach: true, canOpenAssets: true })

    // The menu strings only compile once reka mounts the (lazy) menu content,
    // so walk into the submenu before asserting.
    await userEvent.click(await openAddMenu())
    await screen.findByText('No nodes in this workflow')

    // Unescaped syntax characters (@, |, {) in a locale message compile to an
    // error and silently fall back to the raw string.
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(
      'Message compilation error'
    )

    consoleError.mockRestore()
  })

  it('emits send with the trimmed text and clears the draft', async () => {
    const { emitted } = mount()
    const box = screen.getByRole('textbox')
    await userEvent.type(box, '  make art  ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send[0]).toEqual(['make art', []])
    expect((box as HTMLTextAreaElement).value).toBe('')
  })

  it('sends on Enter but not on Shift+Enter', async () => {
    const { emitted } = mount()
    const box = screen.getByRole('textbox')
    await userEvent.type(box, 'one{Shift>}{Enter}{/Shift}two')
    expect(emitted().send).toBeUndefined()
    await userEvent.type(box, '{Enter}')
    expect(emitted().send).toHaveLength(1)
  })

  it('shows Stop while streaming and emits stop instead of send', async () => {
    const { emitted } = mount({ streaming: true })
    const stop = screen.getByRole('button', { name: 'Stop' })
    await userEvent.click(stop)
    expect(emitted().stop).toHaveLength(1)
    expect(emitted().send).toBeUndefined()
  })

  it('shows Stop instead of a spinner while submitting and emits stop', async () => {
    const { emitted } = mount({ submitting: true })
    const stop = screen.getByRole('button', { name: 'Stop' })
    await userEvent.click(stop)
    expect(emitted().stop).toHaveLength(1)
    expect(emitted().send).toBeUndefined()
  })

  it('restores the typed draft after unmount and remount', async () => {
    const first = mount()
    await userEvent.type(screen.getByRole('textbox'), 'keep me')
    first.unmount()

    mount()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'keep me'
    )
  })

  async function openAddMenu() {
    await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
    // Anchor on the entry that is always present, so the absence assertions
    // below cannot pass against a menu that never opened.
    return screen.findByRole('menuitem', { name: 'Add nodes from graph' })
  }

  it('hides the conditional entries from the add menu by default', async () => {
    mount()

    await openAddMenu()

    expect(
      screen.queryByRole('menuitem', { name: 'Attach images or files' })
    ).toBeNull()
    expect(
      screen.queryByRole('menuitem', { name: 'Add from assets panel' })
    ).toBeNull()
  })

  it('emits attach from the add menu when canAttach is set', async () => {
    const { emitted } = mount({ canAttach: true })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Attach images or files' })
    )

    expect(emitted().attach).toHaveLength(1)
  })

  it('emits openAssets from the add menu when canOpenAssets is set', async () => {
    const { emitted } = mount({ canOpenAssets: true })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Add from assets panel' })
    )

    expect(emitted().openAssets).toHaveLength(1)
  })

  it('explains an empty graph inside the node picker', async () => {
    mount()

    await userEvent.click(await openAddMenu())

    expect(
      await screen.findByText('No nodes in this workflow')
    ).toBeInTheDocument()
  })

  it('reads the graph when the node picker opens, not when the add menu does', async () => {
    const getMentionNodes = vi.fn(() => [])
    mount({ getMentionNodes })

    const picker = await openAddMenu()
    expect(getMentionNodes).not.toHaveBeenCalled()

    await userEvent.click(picker)
    expect(getMentionNodes).toHaveBeenCalledOnce()
  })

  describe('insert highlight', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    function mountWithInsert() {
      const composer = ref<InstanceType<typeof Composer> | null>(null)
      const Host = defineComponent({
        setup: () => () => h(Composer, { ref: composer })
      })
      const { container } = render(Host, { global: { plugins: [i18n] } })
      // eslint-disable-next-line testing-library/no-node-access -- composer root has no queryable role
      const root = container.firstElementChild as HTMLElement
      return {
        root,
        insert: (text: string) => composer.value?.insert(text)
      }
    }

    it('flashes the accent border, focuses the textarea, then clears', async () => {
      const { root, insert } = mountWithInsert()
      const focusSpy = vi.spyOn(screen.getByRole('textbox'), 'focus')

      insert('foo')
      await nextTick()
      expect(root.classList.contains('border-agent-accent')).toBe(true)
      expect(focusSpy).toHaveBeenCalledOnce()

      vi.advanceTimersByTime(1000)
      await nextTick()
      expect(root.classList.contains('border-agent-accent')).toBe(false)
    })

    it('restarts the highlight timer on repeated insert', async () => {
      const { root, insert } = mountWithInsert()

      insert('foo')
      await nextTick()
      vi.advanceTimersByTime(500)

      insert('bar')
      await nextTick()
      expect(vi.getTimerCount()).toBe(1)
      vi.advanceTimersByTime(999)
      await nextTick()
      expect(root.classList.contains('border-agent-accent')).toBe(true)

      vi.advanceTimersByTime(1)
      await nextTick()
      expect(root.classList.contains('border-agent-accent')).toBe(false)
    })
  })
})
