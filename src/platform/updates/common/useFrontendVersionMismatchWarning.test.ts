import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useToast } from '@/components/ui/toast/toastStore'
import { useFrontendVersionMismatchWarning } from '@/platform/updates/common/useFrontendVersionMismatchWarning'
import { useVersionCompatibilityStore } from '@/platform/updates/common/versionCompatibilityStore'

vi.mock(import('@/config'), () => ({
  default: {
    app_title: 'ComfyUI',
    app_version: '1.0.0'
  }
}))

vi.mock(import('@/scripts/app'))

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    getSettings: vi.fn(() => Promise.resolve({})),
    storeSetting: vi.fn(() => Promise.resolve(undefined))
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function mountVersionWarning(
  ...options: Parameters<typeof useFrontendVersionMismatchWarning>
) {
  let result: ReturnType<typeof useFrontendVersionMismatchWarning> | undefined
  const { unmount } = render(
    {
      setup() {
        result = useFrontendVersionMismatchWarning(...options)
        return () => null
      }
    },
    {
      global: { plugins: [i18n] }
    }
  )

  if (!result) throw new Error('Failed to mount version warning')
  return { ...result, unmount }
}

describe('useFrontendVersionMismatchWarning', () => {
  it('should not show warning when there is no version mismatch', () => {
    const toastStore = useToast()
    const versionStore = useVersionCompatibilityStore()
    const warningSpy = vi.spyOn(toastStore, 'warning')

    // Mock no version mismatch
    vi.spyOn(versionStore, 'shouldShowWarning', 'get').mockReturnValue(false)

    mountVersionWarning()

    expect(warningSpy).not.toHaveBeenCalled()
  })

  it('should show warning immediately when immediate option is true and there is a mismatch', async () => {
    const toastStore = useToast()
    const versionStore = useVersionCompatibilityStore()
    const warningSpy = vi.spyOn(toastStore, 'warning')
    const dismissWarningSpy = vi.spyOn(versionStore, 'dismissWarning')

    // Mock version mismatch
    vi.spyOn(versionStore, 'shouldShowWarning', 'get').mockReturnValue(true)
    vi.spyOn(versionStore, 'warningMessage', 'get').mockReturnValue({
      type: 'outdated',
      frontendVersion: '1.0.0',
      requiredVersion: '2.0.0'
    })

    mountVersionWarning({ immediate: true })

    // For immediate: true, the watcher should fire immediately in onMounted
    await nextTick()

    expect(warningSpy).toHaveBeenCalledWith('Version Compatibility Warning', {
      description: expect.stringMatching(
        /^Frontend version 1\.0\.0 is outdated.* Visit https:\/\/docs\.comfy\.org\//
      )
    })
    // Should automatically dismiss the warning
    expect(dismissWarningSpy).toHaveBeenCalled()
  })

  it('should not show warning immediately when immediate option is false', async () => {
    const toastStore = useToast()
    const versionStore = useVersionCompatibilityStore()
    const warningSpy = vi.spyOn(toastStore, 'warning')

    // Mock version mismatch
    vi.spyOn(versionStore, 'shouldShowWarning', 'get').mockReturnValue(true)
    vi.spyOn(versionStore, 'warningMessage', 'get').mockReturnValue({
      type: 'outdated',
      frontendVersion: '1.0.0',
      requiredVersion: '2.0.0'
    })

    const result = mountVersionWarning({ immediate: false })
    await nextTick()

    // Should not show automatically
    expect(warningSpy).not.toHaveBeenCalled()

    // But should show when called manually
    result.showWarning()
    expect(warningSpy).toHaveBeenCalledOnce()
  })

  it('should expose store methods and computed values', () => {
    const versionStore = useVersionCompatibilityStore()

    const mockDismissWarning = vi.fn()
    vi.spyOn(versionStore, 'dismissWarning').mockImplementation(
      mockDismissWarning
    )
    vi.spyOn(versionStore, 'shouldShowWarning', 'get').mockReturnValue(true)
    vi.spyOn(versionStore, 'hasVersionMismatch', 'get').mockReturnValue(true)

    const result = mountVersionWarning()

    expect(result.shouldShowWarning.value).toBe(true)
    expect(result.hasVersionMismatch.value).toBe(true)

    result.dismissWarning()
    expect(mockDismissWarning).toHaveBeenCalled()
  })

  it('stops watching for mismatches after unmount', async () => {
    const toastStore = useToast()
    const versionStore = useVersionCompatibilityStore()
    const warningSpy = vi.spyOn(toastStore, 'warning')
    const shouldShowWarning = ref(false)
    vi.spyOn(versionStore, 'shouldShowWarning', 'get').mockImplementation(
      () => shouldShowWarning.value
    )
    vi.spyOn(versionStore, 'warningMessage', 'get').mockReturnValue({
      type: 'outdated',
      frontendVersion: '1.0.0',
      requiredVersion: '2.0.0'
    })

    const { unmount } = mountVersionWarning({ immediate: true })
    await nextTick()
    unmount()

    shouldShowWarning.value = true
    await nextTick()

    expect(warningSpy).not.toHaveBeenCalled()
  })

  it('should not show warning when warningMessage is null', () => {
    const toastStore = useToast()
    const versionStore = useVersionCompatibilityStore()
    const warningSpy = vi.spyOn(toastStore, 'warning')

    vi.spyOn(versionStore, 'warningMessage', 'get').mockReturnValue(null)

    const { showWarning } = mountVersionWarning()
    showWarning()

    expect(warningSpy).not.toHaveBeenCalled()
  })

  it('should only show warning once even if called multiple times', () => {
    const toastStore = useToast()
    const versionStore = useVersionCompatibilityStore()
    const warningSpy = vi.spyOn(toastStore, 'warning')

    vi.spyOn(versionStore, 'warningMessage', 'get').mockReturnValue({
      type: 'outdated',
      frontendVersion: '1.0.0',
      requiredVersion: '2.0.0'
    })

    const { showWarning } = mountVersionWarning()

    // Call showWarning multiple times
    showWarning()
    showWarning()
    showWarning()

    // Should only have been called once
    expect(warningSpy).toHaveBeenCalledTimes(1)
  })

  it('should emit a separate alert for each outdated comfy package', () => {
    const toastStore = useToast()
    const versionStore = useVersionCompatibilityStore()
    const warningSpy = vi.spyOn(toastStore, 'warning')

    vi.spyOn(versionStore, 'warningMessage', 'get').mockReturnValue(null)
    vi.spyOn(versionStore, 'packageWarningMessages', 'get').mockReturnValue([
      {
        name: 'comfyui-workflow-templates',
        installedVersion: '0.9.0',
        requiredVersion: '0.9.5'
      },
      {
        name: 'comfyui-embedded-docs',
        installedVersion: '0.4.0',
        requiredVersion: '0.5.0'
      }
    ])

    const { showWarning } = mountVersionWarning()
    showWarning()

    expect(warningSpy.mock.calls).toEqual([
      [
        'Version Compatibility Warning',
        {
          description: expect.stringMatching(
            /^Installed comfyui-workflow-templates version 0\.9\.0 /
          )
        }
      ],
      [
        'Version Compatibility Warning',
        {
          description: expect.stringMatching(
            /^Installed comfyui-embedded-docs version 0\.4\.0 /
          )
        }
      ]
    ])
  })
})
