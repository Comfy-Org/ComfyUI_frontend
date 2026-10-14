import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en/main.json'
import MagicPatchProgressBar from './MagicPatchProgressBar.vue'
const hooks = vi.hoisted(() => ({
  poll: undefined as (() => void) | undefined,
  show: vi.fn(),
  close: vi.fn(),
  refresh: vi.fn(),
  cancel: vi.fn(),
  report: vi.fn()
}))
const online = ref(true)
const visibility = ref('visible')
const store = reactive({
  visible: true,
  ready: false,
  installedRevisionIds: [] as string[],
  settled: false,
  consentOpen: false,
  completionAnnounced: false,
  actionFailed: false,
  sourceJobs: [],
  jobs: [
    {
      revision: { revision_id: 'a', name: 'RandomNumbers' },
      state: {
        phase: 'active',
        request: { state: 'waiting_conversion', stage: 'conversion' },
        disconnected: false
      }
    }
  ],
  refresh: hooks.refresh,
  cancel: hooks.cancel,
  readReport: hooks.report,
  dismissConsent: vi.fn(),
  dismissFinished: vi.fn()
})
vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => visibility,
  useOnline: () => online,
  useIntervalFn: (callback: () => void) => {
    hooks.poll = callback
  }
}))
vi.mock('../stores/magicPatchBatchStore', () => ({
  useMagicPatchBatchStore: () => store
}))
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog: hooks.show, closeDialog: hooks.close })
}))
function mount() {
  return render(MagicPatchProgressBar, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}
beforeEach(() => {
  store.visible = true
  store.ready = false
  store.consentOpen = false
  store.completionAnnounced = false
  visibility.value = 'visible'
  online.value = true
})
describe('persistent conversion progress and notification', () => {
  it('shows live pack/stage status and polls outside the consent dialog', () => {
    mount()
    expect(screen.getByText('RandomNumbers')).toBeVisible()
    expect(screen.getByText(en.magicPatch.stages.conversion)).toBeVisible()
    hooks.poll!()
    expect(hooks.refresh).toHaveBeenCalledOnce()
  })
  it('pauses polling while hidden or offline', () => {
    mount()
    visibility.value = 'hidden'
    hooks.poll!()
    visibility.value = 'visible'
    online.value = false
    hooks.poll!()
    expect(hooks.refresh).not.toHaveBeenCalled()
  })
  it('announces verified completion once and leaves reload to the user', async () => {
    mount()
    store.ready = true
    await nextTick()
    expect(hooks.show).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'magic-patch-completed',
        props: { completed: true }
      })
    )
    expect(store.completionAnnounced).toBe(true)
    store.ready = false
    await nextTick()
    store.ready = true
    await nextTick()
    expect(hooks.show).toHaveBeenCalledOnce()
  })
  it('opens one consent dialog for the whole selected list', async () => {
    mount()
    store.consentOpen = true
    await waitFor(() =>
      expect(hooks.show).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'magic-patch-consent' })
      )
    )
  })
})
