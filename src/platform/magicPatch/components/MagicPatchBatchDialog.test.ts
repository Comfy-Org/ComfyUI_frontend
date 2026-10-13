import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en/main.json'
import MagicPatchBatchDialog from './MagicPatchBatchDialog.vue'
const store = vi.hoisted(() => ({
  candidates: [
    {
      name: 'RandomNumbers',
      revision_id: 'a',
      upstream_commit: '123456789012345'
    },
    { name: 'Other pack', revision_id: 'b', upstream_commit: 'abcdef123456789' }
  ],
  jobs: [] as {
    revision: { name: string; revision_id: string; upstream_commit: string }
  }[],
  actionFailed: false,
  reloading: false,
  ready: true,
  dismissConsent: vi.fn(),
  confirm: vi.fn(),
  acknowledge: vi.fn().mockResolvedValue(true)
}))
const close = vi.hoisted(() => vi.fn())
vi.mock('../stores/magicPatchBatchStore', () => ({
  useMagicPatchBatchStore: () => store
}))
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: close })
}))
function mount(completed = false) {
  return render(MagicPatchBatchDialog, {
    props: { completed },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}
describe('batch consent and completion dialogs', () => {
  it('shows the list and waits for explicit consent', async () => {
    mount()
    expect(screen.getByText('RandomNumbers')).toBeVisible()
    expect(screen.getByText('Other pack')).toBeVisible()
    expect(store.confirm).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole('button', { name: en.magicPatch.convertAll })
    )
    expect(store.confirm).toHaveBeenCalledOnce()
  })
  it('does not reload on completion until acknowledged', async () => {
    store.jobs = store.candidates.map((revision) => ({ revision }))
    mount(true)
    expect(store.acknowledge).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole('button', { name: en.magicPatch.acknowledgeReload })
    )
    expect(store.acknowledge).toHaveBeenCalledOnce()
  })
  it('allows delaying acknowledgement without triggering reload', async () => {
    mount(true)
    await userEvent.click(
      screen.getByRole('button', { name: en.magicPatch.later })
    )
    expect(store.acknowledge).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledWith({ key: 'magic-patch-completed' })
  })
})
