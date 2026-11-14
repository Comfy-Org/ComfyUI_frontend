import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    vi.stubGlobal('__comfyDesktop2', undefined)
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

    it('shows the opening page in the reserved tab until it navigates', () => {
      const tab = {
        opener: window,
        document: document.implementation.createHTMLDocument(''),
        location: { href: '' },
        close: vi.fn()
      }
      vi.spyOn(window, 'open').mockReturnValue(tab as never)

      reserveBillingTab({
        lang: 'ko',
        title: 'Opening checkout…',
        detail: 'This takes a few seconds.'
      })

      expect(tab.document.documentElement.lang).toBe('ko')
      expect(tab.document.title).toBe('Opening checkout…')
      expect(
        tab.document
          .querySelector('[role="progressbar"]')
          ?.getAttribute('aria-label')
      ).toBe('Opening checkout…')
      expect(tab.document.body.textContent).toBe(
        'Opening checkout…This takes a few seconds.'
      )
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
        vi.stubGlobal('__comfyDesktop2', {})
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
    vi.stubGlobal('__comfyDesktop2', undefined)
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
        vi.stubGlobal('__comfyDesktop2', {})
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
