import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { testI18n } from '@/utils/__tests__/testI18n'

import { captureSafeExtensionBoot } from './safeExtensionBoot'
import { useSafeExtensionBootNotice } from './useSafeExtensionBootNotice'

function renderNotice() {
  return render(
    { setup: useSafeExtensionBootNotice, template: '<div />' },
    { global: { plugins: [testI18n] } }
  )
}

function bootWith(url: string) {
  window.history.replaceState(null, '', url)
  captureSafeExtensionBoot()
}

describe('useSafeExtensionBootNotice', () => {
  beforeEach(() => {
    bootWith('/')
  })

  it('says custom extensions are off for this load and offers a reload with them on', () => {
    bootWith('/?safe&workflow=a')
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      reload
    })

    renderNotice()

    const [toast] = useToast().toasts
    expect(toast).toMatchObject({
      kind: 'info',
      title: 'Safe mode: custom extensions are off',
      description: 'Only this load skips them. Reload to turn them back on.'
    })
    expect(toast.actions.map(({ label }) => label)).toEqual([
      'Reload with extensions'
    ])

    toast.actions[0].onClick()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('shows nothing on a normal load', () => {
    renderNotice()

    expect(useToast().toasts).toEqual([])
  })
})
