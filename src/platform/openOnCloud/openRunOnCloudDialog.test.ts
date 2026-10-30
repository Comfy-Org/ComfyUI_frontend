import { describe, expect, it } from 'vitest'

import { openRunOnCloudDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useDialogStore } from '@/stores/dialogStore'

describe(openRunOnCloudDialog, () => {
  it('opens nothing once a new check has replaced the answer', async () => {
    useCloudWorkflowCheckStore().state = {
      phase: 'checking',
      run: 2,
      opensModal: true
    }

    await openRunOnCloudDialog()

    expect(useDialogStore().dialogStack).toEqual([])
  })
})
