import { describe, expect, it } from 'vitest'

import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useDialogStore } from '@/stores/dialogStore'

describe('useSettingsDialog without a registered component', () => {
  it('show() reports the failure and opens no dialog', () => {
    useSettingsDialog().show()

    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'failure_opening_settings_dialog',
      surface: 'platform'
    })
    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
  })
})
