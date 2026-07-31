import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import { useAgentRunModeStore } from '../../stores/agent/agentRunModeStore'
import Composer from './Composer.vue'

function mount(props: ComponentProps<typeof Composer> = {}) {
  return render(Composer, { props, global: { plugins: [i18n] } })
}

describe('Composer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the interactive empty-composer hint', () => {
    mount()

    expect(screen.getByText('Describe ideas, @ to reference,')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'add nodes from graph,' })
    ).toBeVisible()
    expect(screen.getByText('or drag in assets')).toBeVisible()
  })

  it('hides the empty-composer hint once typing begins', async () => {
    mount()
    const box = screen.getByRole('textbox')

    await userEvent.type(box, 'hello')

    expect((box as HTMLTextAreaElement).value).toBe('hello')
    expect(
      screen.queryByRole('button', { name: 'add nodes from graph,' })
    ).toBeNull()
  })

  it('opens the graph picker from the empty-composer hint', async () => {
    const node = { id: '5', title: 'KSampler' }
    const getMentionNodes = vi.fn(() => [node])
    const { emitted } = mount({ getMentionNodes })
    const hintButton = screen.getByRole('button', {
      name: 'add nodes from graph,'
    })

    await userEvent.tab()
    await userEvent.tab()
    expect(hintButton).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.click(
      await screen.findByRole('option', { name: 'KSampler' })
    )

    expect(getMentionNodes).toHaveBeenCalledOnce()
    expect(emitted().mentionPick[0]).toEqual([node])
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

    // The menu strings only compile once reka mounts the lazy menu content.
    await openAddMenu()
    await screen.findByRole('menuitem', { name: 'Attach images or files' })

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

  describe('run permissions popover', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('opens from the mode control with the ask mode selected by default', async () => {
      mount()

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))

      expect(
        await screen.findByText('Choose when the agent needs your consent')
      ).toBeInTheDocument()
      expect(
        screen.getByRole('radio', { name: /Ask before a workflow runs/ })
      ).toBeChecked()
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
    })

    it('saves a new run mode with its credit limit and closes', async () => {
      mount()
      const store = useAgentRunModeStore()

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      await userEvent.click(
        await screen.findByRole('radio', { name: /Auto-run with limits/ })
      )
      const save = screen.getByRole('button', { name: 'Save changes' })
      expect(save).toBeEnabled()
      const input = screen.getByRole('spinbutton', { name: 'credits' })
      await userEvent.clear(input)
      await userEvent.type(input, '500')
      expect(save).toBeEnabled()
      await userEvent.click(save)

      expect(store.mode).toBe('auto-limit')
      expect(store.creditLimit).toBe(500)
      expect(
        screen.queryByText('Choose when the agent needs your consent')
      ).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Auto (limited)' })
      ).toBeInTheDocument()
    })

    it('keeps Save disabled while the limit draft is invalid', async () => {
      mount()
      const store = useAgentRunModeStore()
      store.save('auto-limit', 450)

      await userEvent.click(
        await screen.findByRole('button', { name: 'Auto (limited)' })
      )
      const input = await screen.findByRole('spinbutton', { name: 'credits' })
      await userEvent.clear(input)

      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
    })

    it('enables Save when only the credit limit changes', async () => {
      mount()
      const store = useAgentRunModeStore()
      store.save('auto-limit', 450)

      await userEvent.click(
        await screen.findByRole('button', { name: 'Auto (limited)' })
      )
      const save = await screen.findByRole('button', { name: 'Save changes' })
      expect(save).toBeDisabled()

      const input = screen.getByRole('spinbutton', { name: 'credits' })
      await userEvent.clear(input)
      await userEvent.type(input, '460')
      expect(save).toBeEnabled()

      await userEvent.click(save)
      expect(store.creditLimit).toBe(460)
    })

    it('keeps unlimited auto mode distinct from limited auto mode', () => {
      const store = useAgentRunModeStore()
      store.save('auto', 450)

      mount()

      expect(screen.getByRole('button', { name: 'Auto' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Auto (limited)' })
      ).not.toBeInTheDocument()
    })

    it('discards an unsaved draft when the popover closes without saving', async () => {
      mount()
      const store = useAgentRunModeStore()

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      await userEvent.click(
        await screen.findByRole('radio', { name: /Auto-run without approval/ })
      )
      await userEvent.keyboard('{Escape}')
      expect(store.mode).toBe('ask')

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      expect(
        await screen.findByRole('radio', { name: /Ask before a workflow runs/ })
      ).toBeChecked()
    })
  })

  describe('typed @ mention', () => {
    const NODES = [
      { id: '5', title: 'KSampler' },
      { id: '7', title: 'KSampler' },
      { id: '9', title: 'VAE Decode' }
    ]

    it('lists matching nodes alphabetically', async () => {
      mount({
        getMentionNodes: () => [
          { id: '3', title: 'VAE Decode' },
          { id: '1', title: 'Alpha' },
          { id: '2', title: 'KSampler' }
        ]
      })

      await userEvent.type(screen.getByRole('textbox'), '@')

      expect(
        screen
          .getAllByRole('option')
          .map((option) => option.textContent?.trim())
      ).toEqual(['Alpha', 'KSampler', 'VAE Decode'])
    })

    it('opens on @, filters with spaces, and stages the pick on Enter', async () => {
      const { emitted } = mount({ getMentionNodes: () => NODES })
      const box = screen.getByRole('textbox')

      await userEvent.type(box, '@')
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      expect(screen.getAllByRole('option')).toHaveLength(3)
      expect(screen.getByText('#5')).toBeInTheDocument()
      expect(screen.getByText('#7')).toBeInTheDocument()
      expect(screen.queryByText('#9')).not.toBeInTheDocument()

      await userEvent.type(box, 'vae de')
      expect(screen.getAllByRole('option')).toHaveLength(1)
      expect(screen.queryByText('#9')).not.toBeInTheDocument()

      await userEvent.keyboard('{Enter}')
      expect(emitted().mentionPick[0]).toEqual([NODES[2]])
      expect(emitted().send).toBeUndefined()
      expect((box as HTMLTextAreaElement).value).toBe('')
    })

    it('navigates with arrows and inserts with Tab', async () => {
      const { emitted } = mount({ getMentionNodes: () => NODES })

      await userEvent.type(screen.getByRole('textbox'), '@')
      const options = screen.getAllByRole('option')
      await userEvent.keyboard('{ArrowDown}')
      expect(options[1]).toHaveAttribute('aria-selected', 'true')
      await userEvent.keyboard('{ArrowUp}')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
      await userEvent.keyboard('{Tab}')

      expect(emitted().mentionPick[0]).toEqual([NODES[0]])
      expect(emitted().send).toBeUndefined()
    })

    it('keeps a duplicate-title id visible when filtering by id', async () => {
      mount({ getMentionNodes: () => NODES })

      await userEvent.type(screen.getByRole('textbox'), '@5')

      expect(screen.getAllByRole('option')).toHaveLength(1)
      expect(screen.getByText('#5')).toBeInTheDocument()
    })

    it('closes on Escape so Enter sends normally', async () => {
      const { emitted } = mount({ getMentionNodes: () => NODES })
      const box = screen.getByRole('textbox')

      await userEvent.type(box, 'hi @k')
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('listbox')).toBeNull()

      await userEvent.keyboard('{Enter}')
      expect(emitted().send[0]).toEqual(['hi @k', []])
    })

    it('ignores an @ inside a word', async () => {
      mount({ getMentionNodes: () => NODES })

      await userEvent.type(screen.getByRole('textbox'), 'email@k')
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('lets Shift+Enter insert a newline instead of picking', async () => {
      const { emitted } = mount({ getMentionNodes: () => NODES })
      const box = screen.getByRole('textbox')

      await userEvent.type(box, '@k')
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
      expect(emitted().mentionPick).toBeUndefined()
      expect(emitted().send).toBeUndefined()
      expect((box as HTMLTextAreaElement).value).toBe('@k\n')
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('closes when the caret moves out of the token', async () => {
      mount({ getMentionNodes: () => NODES })
      const box = screen.getByRole('textbox')

      await userEvent.type(box, '@k')
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      await userEvent.keyboard('{Home}')
      expect(screen.queryByRole('listbox')).toBeNull()
    })
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

  it('enters graph selection mode without querying the mention picker', async () => {
    const getMentionNodes = vi.fn(() => [])
    const { emitted } = mount({ getMentionNodes })

    await userEvent.click(await openAddMenu())

    expect(emitted().selectNodes).toHaveLength(1)
    expect(getMentionNodes).not.toHaveBeenCalled()
  })

  it('hides the id on a uniquely named selection chip', () => {
    mount({ selectionTags: [{ id: '5', title: 'KSampler' }] })

    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(screen.queryByText('#5')).not.toBeInTheDocument()
  })

  it('shows ids when selection chips have duplicate titles', () => {
    mount({
      selectionTags: [
        { id: '5', title: 'KSampler' },
        { id: '7', title: 'KSampler' }
      ]
    })

    expect(screen.getAllByText('KSampler')).toHaveLength(2)
    expect(screen.getByText('#5')).toBeInTheDocument()
    expect(screen.getByText('#7')).toBeInTheDocument()
  })

  it('renders an attachment preview and removes it from the composer', async () => {
    const composer = ref<InstanceType<typeof Composer> | null>(null)
    const Host = defineComponent({
      setup: () => () => h(Composer, { ref: composer })
    })
    render(Host, { global: { plugins: [i18n] } })
    composer.value?.addAttachment({
      id: 'attachment-1',
      name: 'cat.png',
      ref: 'uploaded_cat.png',
      previewUrl: 'https://example.com/cat.png'
    })
    await nextTick()

    expect(screen.getByRole('img', { name: 'cat.png' })).toHaveAttribute(
      'src',
      'https://example.com/cat.png'
    )

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByRole('img', { name: 'cat.png' })).toBeNull()
  })

  describe('insert', () => {
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
      render(Host, { global: { plugins: [i18n] } })
      return {
        insert: (text: string) => composer.value?.insert(text)
      }
    }

    it('inserts text and focuses without scheduling delayed UI state', async () => {
      const { insert } = mountWithInsert()
      const textarea = screen.getByRole('textbox')
      const focusSpy = vi.spyOn(textarea, 'focus')

      insert('foo')
      await nextTick()

      expect(textarea).toHaveValue('foo')
      expect(textarea).toHaveFocus()
      expect(focusSpy).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
