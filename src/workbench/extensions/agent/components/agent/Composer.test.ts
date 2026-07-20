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

  it('restores the typed draft after unmount and remount', async () => {
    const first = mount()
    await userEvent.type(screen.getByRole('textbox'), 'keep me')
    first.unmount()

    mount()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'keep me'
    )
  })

  it('hides the paperclip by default', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Attach a file' })).toBeNull()
  })

  it('emits attach when the paperclip is clicked and canAttach is set', async () => {
    const { emitted } = mount({ canAttach: true })
    await userEvent.click(screen.getByRole('button', { name: 'Attach a file' }))
    expect(emitted().attach).toHaveLength(1)
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
