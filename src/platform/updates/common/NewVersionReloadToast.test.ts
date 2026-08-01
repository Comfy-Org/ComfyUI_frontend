import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import NewVersionReloadToast from './NewVersionReloadToast.vue'
import { useToastStore } from './toastStore'

const NEW_VERSION_TOAST_GROUP = 'new-version-available'

// Capture the options passed to the composable and expose controllable spies.
const composable = vi.hoisted(() => ({
  showPrompt: undefined as undefined | (() => void),
  hidePrompt: undefined as undefined | (() => void),
  accept: vi.fn(),
  dismiss: vi.fn(),
  checkNow: vi.fn(() => Promise.resolve())
}))

vi.mock('./useNewVersionReloadPrompt', () => ({
  NEW_VERSION_TOAST_GROUP: 'new-version-available',
  useNewVersionReloadPrompt: (options: {
    showPrompt: () => void
    hidePrompt?: () => void
  }) => {
    composable.showPrompt = options.showPrompt
    composable.hidePrompt = options.hidePrompt
    return {
      accept: composable.accept,
      dismiss: composable.dismiss,
      checkNow: composable.checkNow
    }
  }
}))

const removeGroupMock = vi.fn()
vi.mock('primevue', () => ({
  useToast: () => ({ removeGroup: removeGroupMock })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ beforeEach: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      newVersionReload: {
        title: 'New version available',
        detail: 'Reload to get the latest version of ComfyUI.',
        reload: 'Reload',
        dismiss: 'Dismiss'
      }
    }
  }
})

function mountToast() {
  return render(NewVersionReloadToast, {
    global: {
      plugins: [i18n],
      stubs: { Toast: true, Button: true }
    }
  })
}

describe('NewVersionReloadToast', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    composable.accept.mockClear()
    composable.dismiss.mockClear()
    composable.checkNow.mockClear()
    removeGroupMock.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('runs the initial drift check on mount', () => {
    mountToast()
    expect(composable.checkNow).toHaveBeenCalledTimes(1)
  })

  it('adds a sticky, non-closable toast message when the prompt is shown', () => {
    mountToast()
    const toastStore = useToastStore()

    composable.showPrompt?.()

    expect(toastStore.messagesToAdd).toHaveLength(1)
    expect(toastStore.messagesToAdd[0]).toMatchObject({
      group: NEW_VERSION_TOAST_GROUP,
      summary: 'New version available',
      detail: 'Reload to get the latest version of ComfyUI.',
      closable: false
    })
    // Sticky: no auto-dismiss timeout.
    expect(toastStore.messagesToAdd[0].life).toBeUndefined()
  })

  it('removes the toast group when the prompt is hidden', () => {
    mountToast()

    composable.hidePrompt?.()

    expect(removeGroupMock).toHaveBeenCalledWith(NEW_VERSION_TOAST_GROUP)
  })

  it('removes the toast group on unmount', () => {
    const { unmount } = mountToast()
    removeGroupMock.mockClear()

    unmount()

    expect(removeGroupMock).toHaveBeenCalledWith(NEW_VERSION_TOAST_GROUP)
  })
})
