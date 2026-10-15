import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isReloadingForDeploymentSwitch,
  reloadForDeploymentSwitch,
  takeDeploymentSwitchLanding
} from './deploymentSwitchReload'

describe('deployment switch reload', () => {
  const reload = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it('reloads, and the next boot learns once that a switch reloaded it', () => {
    expect(isReloadingForDeploymentSwitch()).toBe(false)

    reloadForDeploymentSwitch()

    expect(reload).toHaveBeenCalledOnce()
    expect(isReloadingForDeploymentSwitch()).toBe(true)
    expect(takeDeploymentSwitchLanding()).toBe(true)
    expect(takeDeploymentSwitchLanding()).toBe(false)
    expect(isReloadingForDeploymentSwitch()).toBe(false)
  })

  it('still reloads when the tab cannot store the mark', () => {
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    reloadForDeploymentSwitch()

    expect(reload).toHaveBeenCalledOnce()
    expect(takeDeploymentSwitchLanding()).toBe(false)
  })
})
