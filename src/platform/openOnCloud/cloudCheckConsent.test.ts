import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useToast } from '@/components/ui/toast/toastStore'
import {
  ASK_BEFORE_CLOUD_CHECK,
  saveAskBeforeCloudCheck
} from '@/platform/openOnCloud/cloudCheckConsent'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/scripts/api'))

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('saveAskBeforeCloudCheck', () => {
  beforeEach(() => {
    const setting = CORE_SETTINGS.find(
      ({ id }) => id === ASK_BEFORE_CLOUD_CHECK
    )
    if (setting) useSettingStore().addSetting(setting)
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
  })

  it('saves the choice without a toast when the server accepts it', async () => {
    await saveAskBeforeCloudCheck(false)

    expect(api.storeSetting).toHaveBeenCalledWith(ASK_BEFORE_CLOUD_CHECK, false)
    expect(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)).toBe(false)
    expect(useToast().toasts).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('shows and reports an HTTP failure to turn asking back on', async () => {
    await saveAskBeforeCloudCheck(false)
    vi.mocked(api.storeSetting).mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: 'Server Error' })
    )

    await saveAskBeforeCloudCheck(true)

    expect(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)).toBe(true)
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        title: "Couldn't save your Comfy Cloud check choice"
      })
    ])
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('500') }),
      expect.objectContaining({
        errorType: 'error_saving_cloud_check_consent'
      })
    )
  })

  it("shows and reports a rejected Don't ask again save", async () => {
    const failure = new Error('offline')
    vi.mocked(api.storeSetting).mockRejectedValueOnce(failure)

    await saveAskBeforeCloudCheck(false)

    expect(useToast().toasts).toHaveLength(1)
    expect(reportError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        errorType: 'error_saving_cloud_check_consent'
      })
    )
  })

  it("describes a failed Don't ask again save without promising a prompt", async () => {
    vi.mocked(api.storeSetting).mockResolvedValueOnce(
      new Response(null, { status: 500 })
    )

    await saveAskBeforeCloudCheck(false)

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        description: 'Comfy Cloud may ask again next time you open ComfyUI.'
      })
    ])
  })

  it.for([
    { outcome: 'refused', status: 400 },
    { outcome: 'indeterminate', status: 500 }
  ])(
    'keeps asking on for the session when turning it back on is $outcome',
    async ({ status }) => {
      await saveAskBeforeCloudCheck(false)
      vi.mocked(api.storeSetting).mockResolvedValueOnce(
        new Response(null, { status })
      )

      await saveAskBeforeCloudCheck(true)

      expect(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)).toBe(true)
    }
  )

  it('turns asking back on at once while an earlier save is still pending', async () => {
    const slowSave = deferredResponse()
    vi.mocked(api.storeSetting).mockReturnValueOnce(slowSave.promise)
    const dontAskAgain = saveAskBeforeCloudCheck(false)
    await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledOnce())

    const askAgain = saveAskBeforeCloudCheck(true)

    expect(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)).toBe(true)
    slowSave.resolve(new Response())
    await Promise.all([dontAskAgain, askAgain])
    expect(api.storeSetting).toHaveBeenLastCalledWith(
      ASK_BEFORE_CLOUD_CHECK,
      true
    )
  })

  it('resends a choice that is already shown when the last save failed', async () => {
    vi.mocked(api.storeSetting).mockRejectedValueOnce(new Error('offline'))
    await saveAskBeforeCloudCheck(false)

    await saveAskBeforeCloudCheck(false)

    expect(api.storeSetting).toHaveBeenCalledTimes(2)
  })

  it('reports a save that rejects without a reason', async () => {
    vi.mocked(api.storeSetting).mockRejectedValueOnce(undefined)

    await saveAskBeforeCloudCheck(false)

    expect(reportError).toHaveBeenCalledOnce()
    expect(useToast().toasts).toHaveLength(1)
  })

  it('sends only the latest choice when it changes before the earlier save starts', async () => {
    const dontAskAgain = saveAskBeforeCloudCheck(false)
    const askAgain = saveAskBeforeCloudCheck(true)
    await Promise.all([dontAskAgain, askAgain])

    expect(vi.mocked(api.storeSetting).mock.calls).toEqual([
      [ASK_BEFORE_CLOUD_CHECK, true]
    ])
    expect(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)).toBe(true)
  })
})
