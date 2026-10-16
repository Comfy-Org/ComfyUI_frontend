import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { openBillingUrl, reserveBillingTab } from './billingTab'

const distribution = vi.hoisted(() => ({ isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isDesktop() {
    return distribution.isDesktop
  }
}))

const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test'

function stubBlankTab() {
  const tab = { opener: window, location: { href: '' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as never)
  return { tab, open }
}

describe('billing tab', () => {
  beforeEach(() => {
    distribution.isDesktop = false
    delete window.__comfyDesktop2
  })

  afterEach(() => {
    delete window.__comfyDesktop2
  })

  describe('on the web', () => {
    it('reserves a disowned blank tab and navigates it once the URL is known', () => {
      const { tab, open } = stubBlankTab()

      const reserved = reserveBillingTab()
      expect(open).toHaveBeenCalledWith('', '_blank')
      expect(tab.opener).toBeNull()

      reserved?.navigate(checkoutUrl)
      expect(tab.location.href).toBe(checkoutUrl)
    })

    it('opens a known URL directly', () => {
      const { open } = stubBlankTab()

      expect(openBillingUrl(checkoutUrl)).toBe(true)
      expect(open).toHaveBeenCalledWith(checkoutUrl, '_blank')
    })

    it('reports a blocked tab', () => {
      vi.spyOn(window, 'open').mockReturnValue(null)

      expect(reserveBillingTab()).toBeNull()
      expect(openBillingUrl(checkoutUrl)).toBe(false)
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

    it('opens nothing until the URL is known, then hands it to the host', () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)

      const reserved = reserveBillingTab()
      expect(open).not.toHaveBeenCalled()

      reserved?.navigate(checkoutUrl)
      expect(open).toHaveBeenCalledWith(checkoutUrl, '_blank')
    })

    it('treats the null handle as opened', () => {
      vi.spyOn(window, 'open').mockReturnValue(null)

      expect(openBillingUrl(checkoutUrl)).toBe(true)
    })
  })
})
