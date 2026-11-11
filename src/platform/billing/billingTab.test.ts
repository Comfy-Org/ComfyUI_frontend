import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { openBillingUrl, reserveBillingTab } from './billingTab'

const distribution = vi.hoisted(() => ({ isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isDesktop() {
    return distribution.isDesktop
  }
}))

const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test'

describe('reserveBillingTab', () => {
  beforeEach(() => {
    distribution.isDesktop = false
    delete window.__comfyDesktop2
  })

  afterEach(() => {
    delete window.__comfyDesktop2
  })

  describe('on the web', () => {
    it('reserves a disowned blank tab and navigates it once the URL is known', () => {
      const tab = { opener: window, location: { href: '' }, close: vi.fn() }
      const open = vi.spyOn(window, 'open').mockReturnValue(tab as never)

      const reserved = reserveBillingTab()
      expect(open).toHaveBeenCalledWith('', '_blank')
      expect(tab.opener).toBeNull()

      reserved?.navigate(checkoutUrl)
      expect(tab.location.href).toBe(checkoutUrl)
    })

    it('reports a blocked tab', () => {
      vi.spyOn(window, 'open').mockReturnValue(null)

      expect(reserveBillingTab()).toBeNull()
    })
  })

  describe.for([
    {
      host: 'local Desktop',
      arrange: () => {
        distribution.isDesktop = true
      }
    },
    {
      host: 'cloud Desktop',
      arrange: () => {
        window.__comfyDesktop2 = {}
      }
    }
  ])('on $host', ({ arrange }) => {
    beforeEach(arrange)

    it('opens nothing until the URL is known, then hands it to the host despite a null handle', () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)

      const reserved = reserveBillingTab()
      expect(reserved).not.toBeNull()
      expect(open).not.toHaveBeenCalled()

      reserved?.navigate(checkoutUrl)
      expect(open).toHaveBeenCalledWith(checkoutUrl, '_blank')
    })
  })
})

describe('openBillingUrl', () => {
  beforeEach(() => {
    distribution.isDesktop = false
    delete window.__comfyDesktop2
  })

  afterEach(() => {
    delete window.__comfyDesktop2
  })

  it.for([
    {
      host: 'the web, opened',
      arrange: () => {},
      handle: window,
      opened: true
    },
    {
      host: 'the web, blocked',
      arrange: () => {},
      handle: null,
      opened: false
    },
    {
      host: 'local Desktop',
      arrange: () => {
        distribution.isDesktop = true
      },
      handle: null,
      opened: true
    },
    {
      host: 'cloud Desktop',
      arrange: () => {
        window.__comfyDesktop2 = {}
      },
      handle: null,
      opened: true
    }
  ])('on $host reports opened=$opened', ({ arrange, handle, opened }) => {
    arrange()
    const open = vi.spyOn(window, 'open').mockReturnValue(handle)

    expect(openBillingUrl(checkoutUrl)).toBe(opened)
    expect(open).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })
})
