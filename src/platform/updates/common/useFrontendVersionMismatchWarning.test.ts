import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { useFrontendVersionMismatchWarning } from '@/platform/updates/common/useFrontendVersionMismatchWarning'
import { useVersionCompatibilityStore } from '@/platform/updates/common/versionCompatibilityStore'

vi.mock('@/config', () => ({
  default: {
    app_title: 'ComfyUI',
    app_version: '1.0.0'
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    ui: {
      settings: {
        dispatchChange: vi.fn()
      }
    }
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    getSettings: vi.fn(() => Promise.resolve({})),
    storeSetting: vi.fn(() => Promise.resolve(undefined))
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number> | unknown) => {
      if (key === 'g.versionMismatchWarning')
        return 'Version Compatibility Warning'
      if (key === 'g.versionMismatchWarningMessage' && params) {
        const p = params as Record<string, string>
        return `${p.warning}: ${p.detail} Visit https://docs.comfy.org/installation/update_comfyui#common-update-issues for update instructions.`
      }
      if (key === 'g.frontendOutdated' && params) {
        const p = params as Record<string, string>
        return `Frontend version ${p.frontendVersion} is outdated. Backend requires ${p.requiredVersion} or higher.`
      }
      if (key === 'g.frontendNewer' && params) {
        const p = params as Record<string, string>
        return `Frontend version ${p.frontendVersion} may not be compatible with backend version ${p.backendVersion}.`
      }
      if (key === 'g.comfyPackageOutdated' && params) {
        const p = params as Record<string, string>
        return `Installed ${p.name} version ${p.installedVersion} is lower than the required version ${p.requiredVersion}.`
      }
      return key
    }
  }),
  createI18n: vi.fn(() => ({
    global: {
      locale: { value: 'en' },
      t: vi.fn()
    }
  }))
}))

function mountVersionWarning(
  ...options: Parameters<typeof useFrontendVersionMismatchWarning>
) {
  let result: ReturnType<typeof useFrontendVersionMismatchWarning> | undefined
  const { unmount } = render({
    setup() {
      result = useFrontendVersionMismatchWarning(...options)
      return () => null
    }
  })

  if (!result) throw new Error('Failed to mount version warning')
  return { ...result, unmount }
}

describe('useFrontendVersionMismatchWarning', () => {
  it('should not show warning when there is no version mismatch', () => {
    const toastStore = useToastStore()
    const versionStore = useVersionCompatibilityStore()
    const addAlertSpy = vi.spyOn(toastStore, 'addAlert')

    // Mock no version mismatch
    vi.spyOn(versionStore, 'shouldShowWarning', 'get').mockReturnValue(false)

    mountVersionWarning()

    expect(addAlertSpy).not.toHaveBeenCalled()
  })

  it('should show warning immediately when immediate option is true and there is a mismatch', async () => {
    const toastStore = useToastStore()
    const versionStore = useVersionCompatibilityStore()
    const addAlertSpy = vi.spyOn(toastStore, 'addAlert')
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

    expect(addAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Version Compatibility Warning')
    )
    expect(addAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Frontend version 1.0.0 is outdated')
    )
    // Should automatically dismiss the warning
    expect(dismissWarningSpy).toHaveBeenCalled()
  })

  it('should not show warning immediately when immediate option is false', async () => {
    const toastStore = useToastStore()
    const versionStore = useVersionCompatibilityStore()
    const addAlertSpy = vi.spyOn(toastStore, 'addAlert')

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
    expect(addAlertSpy).not.toHaveBeenCalled()

    // But should show when called manually
    result.showWarning()
    expect(addAlertSpy).toHaveBeenCalledOnce()
  })

  it('should call showWarning method manually', () => {
    const toastStore = useToastStore()
    const versionStore = useVersionCompatibilityStore()
    const addAlertSpy = vi.spyOn(toastStore, 'addAlert')
    const dismissWarningSpy = vi.spyOn(versionStore, 'dismissWarning')

    vi.spyOn(versionStore, 'warningMessage', 'get').mockReturnValue({
      type: 'outdated',
      frontendVersion: '1.0.0',
      requiredVersion: '2.0.0'
    })

    const { showWarning } = mountVersionWarning()
    showWarning()

    expect(addAlertSpy).toHaveBeenCalledOnce()
    expect(dismissWarningSpy).toHaveBeenCalled()
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

    void result.dismissWarning()
    expect(mockDismissWarning).toHaveBeenCalled()
  })

  it('stops watching for mismatches after unmount', async () => {
    const toastStore = useToastStore()
    const versionStore = useVersionCompatibilityStore()
    const addAlertSpy = vi.spyOn(toastStore, 'addAlert')
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

    expect(addAlertSpy).not.toHaveBeenCalled()
  })

  it('should not show warning when warningMessage is null', () => {
    const toastStore = useToastStore()
    const versionStore = useVersionCompatibilityStore()
    const addAlertSpy = vi.spyOn(toastStore, 'addAlert')

    vi.spyOn(versionStore, 'warningMessage', 'get').mockReturnValue(null)

    const { showWarning } = mountVersionWarning()
    showWarning()

    expect(addAlertSpy).not.toHaveBeenCalled()
  })

  it('should only show warning once even if called multiple times', () => {
    const toastStore = useToastStore()
    const versionStore = useVersionCompatibilityStore()
    const addAlertSpy = vi.spyOn(toastStore, 'addAlert')

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
    expect(addAlertSpy).toHaveBeenCalledTimes(1)
  })

  it('should emit a separate alert for each outdated comfy package', () => {
    const toastStore = useToastStore()
    const versionStore = useVersionCompatibilityStore()
    const addAlertSpy = vi.spyOn(toastStore, 'addAlert')

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

    expect(addAlertSpy).toHaveBeenCalledTimes(2)
    expect(addAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Installed comfyui-workflow-templates version 0.9.0'
      )
    )
    expect(addAlertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Installed comfyui-embedded-docs version 0.4.0')
    )
  })
})
