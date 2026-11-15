import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { i18n } from '@/i18n'
import { api } from '@/scripts/api'
import { useDialogStore } from '@/stores/dialogStore'

import QueueClearHistoryDialog from './QueueClearHistoryDialog.vue'

vi.mock(import('@/scripts/api'))

it('keeps history confirmation open after a failed clear and allows retry', async () => {
  vi.mocked(api.clearItems)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true)
  const closeDialog = vi.spyOn(useDialogStore(), 'closeDialog')
  const user = userEvent.setup()
  render(QueueClearHistoryDialog, { global: { plugins: [i18n] } })

  await user.click(screen.getByRole('button', { name: 'Clear' }))

  expect(closeDialog).not.toHaveBeenCalled()
  expect(useToast().error).toHaveBeenCalledWith(
    i18n.global.t('queue.failedToClearJobs')
  )
  expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Clear' }))

  expect(closeDialog).toHaveBeenCalledOnce()
})
