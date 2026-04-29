import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SnackbarToastApi } from '@/composables/useSnackbarToast'
import { useSnackbarToast } from '@/composables/useSnackbarToast'

import SnackbarToastProvider from './SnackbarToastProvider.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { dismiss: 'Dismiss' } } }
})

let capturedApi: SnackbarToastApi | null = null

const Harness = defineComponent({
  setup() {
    capturedApi = useSnackbarToast()
    return () => h('div', { 'data-testid': 'harness' })
  }
})

function setup(): {
  user: ReturnType<typeof userEvent.setup>
  api: SnackbarToastApi
  unmount: () => void
} {
  capturedApi = null
  const user = userEvent.setup()
  const { unmount } = render(SnackbarToastProvider, {
    slots: { default: () => h(Harness) },
    global: { plugins: [i18n] }
  })
  const api = capturedApi
  if (!api) throw new Error('Harness did not capture api')
  return { user, api, unmount }
}

describe('SnackbarToastProvider', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    // happy-dom doesn't implement these; reka-ui ToastClose/ToastAction call them
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false
      Element.prototype.releasePointerCapture = () => {}
      Element.prototype.setPointerCapture = () => {}
    }
  })

  afterEach(() => {
    capturedApi = null
  })

  it('renders no toast initially', () => {
    setup()
    expect(screen.getByTestId('harness')).toBeInTheDocument()
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })

  it('renders a toast after show()', async () => {
    const { api } = setup()
    api.show('Hello world')
    await nextTick()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('replaces an existing toast on rapid show() (singleton)', async () => {
    const { api } = setup()
    api.show('first')
    api.show('second')
    await nextTick()
    expect(screen.queryByText('first')).not.toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
  })

  it('renders a shortcut badge when shortcut is provided', async () => {
    const { api } = setup()
    api.show('Links hidden', { shortcut: 'Ctrl+A' })
    await nextTick()
    const badge = screen.getByText('Ctrl+A')
    expect(badge).toBeInTheDocument()
    // when shortcut is set, the action button must NOT render
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('renders an action button when actionLabel is provided without shortcut', async () => {
    const { api } = setup()
    const onAction = vi.fn()
    api.show('Subgraph unpacked', { actionLabel: 'Undo', onAction })
    await nextTick()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('does not render action button when shortcut is also set', async () => {
    const { api } = setup()
    api.show('msg', {
      shortcut: 'Ctrl+A',
      actionLabel: 'Undo',
      onAction: vi.fn()
    })
    await nextTick()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('action click invokes the callback and dismisses the toast', async () => {
    const { user, api } = setup()
    const onAction = vi.fn()
    api.show('msg', { actionLabel: 'Undo', onAction })
    await nextTick()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await nextTick()

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('msg')).not.toBeInTheDocument()
  })

  it('dismisses the toast even when the action callback throws', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { user, api } = setup()
    const onAction = vi.fn(() => {
      throw new Error('boom')
    })
    api.show('msg', { actionLabel: 'Undo', onAction })
    await nextTick()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await nextTick()

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('msg')).not.toBeInTheDocument()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('dismiss(id) removes the targeted toast', async () => {
    const { api } = setup()
    const id = api.show('first')
    await nextTick()
    expect(screen.getByText('first')).toBeInTheDocument()
    api.dismiss(id)
    await nextTick()
    expect(screen.queryByText('first')).not.toBeInTheDocument()
  })

  it('dismiss(id) for an unknown id is a no-op', async () => {
    const { api } = setup()
    api.show('first')
    await nextTick()
    api.dismiss('non-existent')
    await nextTick()
    expect(screen.getByText('first')).toBeInTheDocument()
  })

  it('show() returns a unique id per call', () => {
    const { api } = setup()
    const a = api.show('a')
    const b = api.show('b')
    expect(a).not.toEqual(b)
  })
})
