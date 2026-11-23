import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import {
  FAN_OUT_CONFIRM_THRESHOLD,
  confirmFanOutIfNeeded
} from '@/composables/queue/confirmFanOut'
import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'

function renderDialogHost(statusToast: boolean) {
  useSettingStore().settingValues['Comfy.Queue.StatusToast'] = statusToast
  render(GlobalDialog, { global: { plugins: [i18n] } })
  return userEvent.setup()
}

describe('confirmFanOutIfNeeded', () => {
  it('asks before five or more runs and resolves true on confirm', async () => {
    const user = renderDialogHost(true)
    const answer = confirmFanOutIfNeeded(FAN_OUT_CONFIRM_THRESHOLD)

    const dialog = await screen.findByRole('dialog', {
      name: 'Start 5 runs at once?'
    })
    expect(dialog).toHaveTextContent(
      'They run side by side and each one uses credits. To run them one after another, set the count to 1.'
    )
    await user.click(screen.getByRole('button', { name: 'Start 5 runs' }))

    await expect(answer).resolves.toBe(true)
  })

  it('resolves false when the user cancels', async () => {
    const user = renderDialogHost(true)
    const answer = confirmFanOutIfNeeded(8)

    await screen.findByRole('dialog', { name: 'Start 8 runs at once?' })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await expect(answer).resolves.toBe(false)
  })

  it.for([
    { batchCount: FAN_OUT_CONFIRM_THRESHOLD - 1, statusToast: true },
    { batchCount: FAN_OUT_CONFIRM_THRESHOLD, statusToast: false }
  ])(
    'lets $batchCount runs through without asking with the status toast $statusToast',
    async ({ batchCount, statusToast }) => {
      renderDialogHost(statusToast)

      await expect(confirmFanOutIfNeeded(batchCount)).resolves.toBe(true)
      expect(screen.queryByRole('dialog')).toBeNull()
    }
  )
})
