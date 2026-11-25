import { describe, expect, it } from 'vitest'

import { openRunOnCloudDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useDialogStore } from '@/stores/dialogStore'

describe(openRunOnCloudDialog, () => {
  it('opens the dialog when the answer is still current after loading', async () => {
    await expect(openRunOnCloudDialog(() => true)).resolves.toBe(true)

    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      true
    )
  })

  it('opens nothing when the workflow changed while the dialog was loading', async () => {
    let current = true
    const opening = openRunOnCloudDialog(() => current)
    current = false

    await expect(opening).resolves.toBe(false)
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )
  })
})
