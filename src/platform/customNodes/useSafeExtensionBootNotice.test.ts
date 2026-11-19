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
    bootWith('/?safe&workflow=a#graph')
    // A Cloud workspace switch can write the flag back before the click.
    window.history.replaceState(null, '', '/?workflow=a&safe=1#graph')
    const replace = vi
      .spyOn(window.location, 'replace')
      .mockImplementation(() => {})

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
    expect(replace).toHaveBeenCalledExactlyOnceWith(
      `${window.location.origin}/?workflow=a#graph`
    )
  })

  it('shows the notice again after a layout swap cleared it, without stacking copies', () => {
    bootWith('/?safe')

    renderNotice()
    renderNotice()
    expect(useToast().toasts).toHaveLength(1)

    useToast().dismissAll()
    renderNotice()
    expect(useToast().toasts).toHaveLength(1)
  })

  it('shows nothing on a normal load', () => {
    renderNotice()

    expect(useToast().toasts).toEqual([])
  })
})
