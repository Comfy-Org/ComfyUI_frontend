import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import { useToast } from '@/components/ui/toast/toastStore'
import {
  ASK_BEFORE_CLOUD_CHECK,
  CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS,
  LATEST_CHOICE_KEY,
  PENDING_ASK_AGAIN_KEY,
  saveAskBeforeCloudCheck,
  skipsCloudCheckQuestion
} from '@/platform/openOnCloud/cloudCheckConsent'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/scripts/api'))

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function choiceSavedInAnotherTab(
  askBeforeCheck: boolean,
  { confirmed }: { confirmed: boolean }
) {
  const stored = localStorage.getItem(LATEST_CHOICE_KEY)
  const previousRevision = stored ? Number(JSON.parse(stored).revision) : 0
  localStorage.setItem(
    LATEST_CHOICE_KEY,
    JSON.stringify({ askBeforeCheck, revision: previousRevision + 1 })
  )
  if (askBeforeCheck && !confirmed)
    localStorage.setItem(PENDING_ASK_AGAIN_KEY, 'true')
  else localStorage.removeItem(PENDING_ASK_AGAIN_KEY)
}

describe('saveAskBeforeCloudCheck', () => {
  beforeEach(() => {
    const setting = CORE_SETTINGS.find(
      ({ id }) => id === ASK_BEFORE_CLOUD_CHECK
    )
    if (setting) useSettingStore().addSetting(setting)
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
    localStorage.clear()
    api.user = ''
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

  it("resends another tab's newer choice when this tab's save lands after it", async () => {
    const dontAskAgainSave = deferredResponse()
    vi.mocked(api.storeSetting)
      .mockReturnValueOnce(dontAskAgainSave.promise)
      .mockResolvedValue(new Response())
    const dontAskAgain = saveAskBeforeCloudCheck(false)
    await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledOnce())
    choiceSavedInAnotherTab(true, { confirmed: false })

    dontAskAgainSave.resolve(new Response())
    await dontAskAgain
    await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledTimes(2))

    expect(api.storeSetting).toHaveBeenLastCalledWith(
      ASK_BEFORE_CLOUD_CHECK,
      true
    )
    expect(skipsCloudCheckQuestion()).toBe(false)
  })

  it('sends a newer choice from this tab once when an earlier save lands after it was made', async () => {
    const dontAskAgainSave = deferredResponse()
    vi.mocked(api.storeSetting)
      .mockReturnValueOnce(dontAskAgainSave.promise)
      .mockResolvedValue(new Response())
    const dontAskAgain = saveAskBeforeCloudCheck(false)
    await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledOnce())
    const askAgain = saveAskBeforeCloudCheck(true)

    dontAskAgainSave.resolve(new Response())
    await Promise.all([dontAskAgain, askAgain])

    expect(vi.mocked(api.storeSetting).mock.calls).toEqual([
      [ASK_BEFORE_CLOUD_CHECK, false],
      [ASK_BEFORE_CLOUD_CHECK, true]
    ])
  })

  it('reports a stalled save and moves on to the next choice', async () => {
    vi.useFakeTimers()
    try {
      const stalledSave = deferredResponse()
      vi.mocked(api.storeSetting).mockReturnValueOnce(stalledSave.promise)
      const dontAskAgain = saveAskBeforeCloudCheck(false)
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledOnce())
      const askAgain = saveAskBeforeCloudCheck(true)

      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await Promise.all([dontAskAgain, askAgain])

      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Timed out')
        }),
        expect.objectContaining({
          errorType: 'error_saving_cloud_check_consent'
        })
      )
      expect(api.storeSetting).toHaveBeenLastCalledWith(
        ASK_BEFORE_CLOUD_CHECK,
        true
      )
      expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBe('true')

      stalledSave.resolve(new Response())
      await vi.waitFor(() =>
        expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBeNull()
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows no toast for a failed save that a later choice replaced', async () => {
    const slowSave = deferredResponse()
    vi.mocked(api.storeSetting).mockReturnValueOnce(slowSave.promise)
    const dontAskAgain = saveAskBeforeCloudCheck(false)
    await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledOnce())
    const askAgain = saveAskBeforeCloudCheck(true)

    slowSave.resolve(new Response(null, { status: 500 }))
    await Promise.all([dontAskAgain, askAgain])

    expect(reportError).toHaveBeenCalledOnce()
    expect(useToast().toasts).toEqual([])
  })

  it('reports a choice that fails to apply in memory', async () => {
    const failure = new Error('listener failed')
    vi.spyOn(useSettingStore(), 'applySettingLocally').mockRejectedValueOnce(
      failure
    )

    await expect(saveAskBeforeCloudCheck(false)).resolves.toBeUndefined()

    expect(reportError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ errorType: 'error_saving_cloud_check_consent' })
    )
  })

  it('resends the latest choice when a timed-out save lands after it', async () => {
    vi.useFakeTimers()
    try {
      const lateSave = deferredResponse()
      vi.mocked(api.storeSetting).mockReturnValueOnce(lateSave.promise)
      const dontAskAgain = saveAskBeforeCloudCheck(false)
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledOnce())
      const askAgain = saveAskBeforeCloudCheck(true)
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await Promise.all([dontAskAgain, askAgain])
      expect(api.storeSetting).toHaveBeenCalledTimes(2)

      expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBe('true')
      lateSave.resolve(new Response())
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledTimes(3))
      await vi.waitFor(() =>
        expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBeNull()
      )

      expect(api.storeSetting).toHaveBeenLastCalledWith(
        ASK_BEFORE_CLOUD_CHECK,
        true
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('sends nothing more when a timed-out save lands with no newer choice', async () => {
    vi.useFakeTimers()
    try {
      const lateSave = deferredResponse()
      vi.mocked(api.storeSetting).mockReturnValueOnce(lateSave.promise)
      const dontAskAgain = saveAskBeforeCloudCheck(false)
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await dontAskAgain

      lateSave.resolve(new Response())
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)

      expect(api.storeSetting).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('confirms ask-again when its timed-out save lands with no newer choice', async () => {
    vi.useFakeTimers()
    try {
      const lateSave = deferredResponse()
      vi.mocked(api.storeSetting).mockReturnValueOnce(lateSave.promise)
      const askAgain = saveAskBeforeCloudCheck(true)
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await askAgain
      expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBe('true')

      lateSave.resolve(new Response())
      await vi.waitFor(() =>
        expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBeNull()
      )

      expect(api.storeSetting).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resends ask-again when its late save lands after a conflicting choice, even if the newest save fails', async () => {
    vi.useFakeTimers()
    try {
      const lateAskAgain = deferredResponse()
      const slowDontAskAgain = deferredResponse()
      vi.mocked(api.storeSetting)
        .mockReturnValueOnce(lateAskAgain.promise)
        .mockReturnValueOnce(slowDontAskAgain.promise)
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
      const firstAskAgain = saveAskBeforeCloudCheck(true)
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await firstAskAgain
      const dontAskAgain = saveAskBeforeCloudCheck(false)
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledTimes(2))
      const secondAskAgain = saveAskBeforeCloudCheck(true)

      lateAskAgain.resolve(new Response())
      await vi.advanceTimersByTimeAsync(0)
      expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBe('true')

      slowDontAskAgain.resolve(new Response())
      await Promise.all([dontAskAgain, secondAskAgain])

      expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBe('true')
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledTimes(4))
      expect(api.storeSetting).toHaveBeenLastCalledWith(
        ASK_BEFORE_CLOUD_CHECK,
        true
      )
      await vi.waitFor(() =>
        expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBeNull()
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps ask-again pending when another tab cleared it and the repair after a late save fails', async () => {
    vi.useFakeTimers()
    try {
      const lateDontAskAgain = deferredResponse()
      vi.mocked(api.storeSetting)
        .mockReturnValueOnce(lateDontAskAgain.promise)
        .mockResolvedValueOnce(new Response())
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
      const dontAskAgain = saveAskBeforeCloudCheck(false)
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await dontAskAgain
      await saveAskBeforeCloudCheck(true)
      localStorage.removeItem(PENDING_ASK_AGAIN_KEY)

      lateDontAskAgain.resolve(new Response())
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledTimes(3))
      await vi.advanceTimersByTimeAsync(0)

      expect(api.storeSetting).toHaveBeenLastCalledWith(
        ASK_BEFORE_CLOUD_CHECK,
        true
      )
      expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it("repairs with another tab's newer ask-again, not this tab's older choice, when a late save lands", async () => {
    vi.useFakeTimers()
    try {
      const lateAskAgain = deferredResponse()
      vi.mocked(api.storeSetting)
        .mockReturnValueOnce(lateAskAgain.promise)
        .mockResolvedValue(new Response())
      const askAgain = saveAskBeforeCloudCheck(true)
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await askAgain
      await saveAskBeforeCloudCheck(false)
      choiceSavedInAnotherTab(true, { confirmed: true })

      lateAskAgain.resolve(new Response())
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledTimes(3))

      expect(api.storeSetting).toHaveBeenLastCalledWith(
        ASK_BEFORE_CLOUD_CHECK,
        true
      )
      expect(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)).toBe(true)
      expect(skipsCloudCheckQuestion()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps ask-again pending when a late save from this tab lands after another tab failed to confirm it', async () => {
    vi.useFakeTimers()
    try {
      const lateAskAgain = deferredResponse()
      vi.mocked(api.storeSetting)
        .mockReturnValueOnce(lateAskAgain.promise)
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
      const askAgain = saveAskBeforeCloudCheck(true)
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await askAgain
      choiceSavedInAnotherTab(false, { confirmed: true })
      choiceSavedInAnotherTab(true, { confirmed: false })

      lateAskAgain.resolve(new Response())
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledTimes(2))
      await vi.advanceTimersByTimeAsync(0)

      expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps one profile's ask-again when another profile saves Don't ask again before its late save lands", async () => {
    vi.useFakeTimers()
    try {
      const lateAskAgain = deferredResponse()
      vi.mocked(api.storeSetting)
        .mockReturnValueOnce(lateAskAgain.promise)
        .mockResolvedValue(new Response())
      api.user = 'profile-a'
      const askAgain = saveAskBeforeCloudCheck(true)
      await vi.advanceTimersByTimeAsync(CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS)
      await askAgain
      api.user = 'profile-b'
      await saveAskBeforeCloudCheck(false)
      api.user = 'profile-a'

      lateAskAgain.resolve(new Response())
      await vi.advanceTimersByTimeAsync(0)

      expect(vi.mocked(api.storeSetting).mock.calls).toEqual([
        [ASK_BEFORE_CLOUD_CHECK, true],
        [ASK_BEFORE_CLOUD_CHECK, false]
      ])
      expect(skipsCloudCheckQuestion()).toBe(false)
    } finally {
      api.user = ''
      vi.useRealTimers()
    }
  })

  it('stops resending once every late save for an older choice has landed', async () => {
    vi.useFakeTimers()
    try {
      const slowSaveMs = CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS * 1.5
      vi.mocked(api.storeSetting).mockImplementation(
        () =>
          new Promise<Response>((resolve) =>
            setTimeout(() => resolve(new Response()), slowSaveMs)
          )
      )
      void saveAskBeforeCloudCheck(true)
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledOnce())
      void saveAskBeforeCloudCheck(false)
      await vi.advanceTimersByTimeAsync(slowSaveMs * 20)
      const settledWrites = vi.mocked(api.storeSetting).mock.calls.length

      await vi.advanceTimersByTimeAsync(slowSaveMs * 20)

      expect(api.storeSetting).toHaveBeenCalledTimes(settledWrites)
      expect(api.storeSetting).toHaveBeenLastCalledWith(
        ASK_BEFORE_CLOUD_CHECK,
        false
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('remembers an ask-again choice in this browser until the server confirms it', async () => {
    const slowSave = deferredResponse()
    vi.mocked(api.storeSetting).mockReturnValueOnce(slowSave.promise)

    const askAgain = saveAskBeforeCloudCheck(true)

    expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBe('true')
    slowSave.resolve(new Response())
    await askAgain
    expect(localStorage.getItem(PENDING_ASK_AGAIN_KEY)).toBeNull()
  })

  it('asks and resends ask-again when a reload lost the unsaved choice', async () => {
    await saveAskBeforeCloudCheck(false)
    localStorage.setItem(PENDING_ASK_AGAIN_KEY, 'true')

    expect(skipsCloudCheckQuestion()).toBe(false)

    expect(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)).toBe(true)
    await vi.waitFor(() =>
      expect(api.storeSetting).toHaveBeenLastCalledWith(
        ASK_BEFORE_CLOUD_CHECK,
        true
      )
    )
  })

  it("skips the question only when the saved choice is Don't ask again", async () => {
    expect(skipsCloudCheckQuestion()).toBe(false)

    await saveAskBeforeCloudCheck(false)

    expect(skipsCloudCheckQuestion()).toBe(true)
  })
  it("asks when another tab turned asking back on after this tab loaded Don't ask again", async () => {
    await saveAskBeforeCloudCheck(false)
    expect(skipsCloudCheckQuestion()).toBe(true)

    choiceSavedInAnotherTab(true, { confirmed: true })

    expect(skipsCloudCheckQuestion()).toBe(false)
  })
})

describe('skipsCloudCheckQuestion before settings load', () => {
  it('asks when the setting is not registered yet', () => {
    localStorage.clear()

    expect(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)).toBeUndefined()
    expect(skipsCloudCheckQuestion()).toBe(false)
  })
})
