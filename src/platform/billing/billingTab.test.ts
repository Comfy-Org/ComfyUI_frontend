import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  openBillingUrl,
  reserveBillingTab,
  reserveSinglePurchaseTab
} from './billingTab'

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
        tabTitle: 'Opening checkout · Comfy',
        title: 'Opening checkout…',
        detail: 'This takes a few seconds.'
      })

      expect(tab.document.documentElement.lang).toBe('ko')
      expect(tab.document.title).toBe('Opening checkout · Comfy')
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

describe('reserveSinglePurchaseTab', () => {
  beforeEach(() => {
    distribution.isDesktop = false
    vi.stubGlobal('__comfyDesktop2', undefined)
  })

  function fakeTab() {
    return {
      opener: window as Window | null,
      closed: false,
      focus: vi.fn(),
      close: vi.fn(),
      location: { href: '', origin: 'https://billing.comfy.org' }
    }
  }

  function stubOpenTabs() {
    const opened: ReturnType<typeof fakeTab>[] = []
    vi.spyOn(window, 'open').mockImplementation(() => {
      const tab = fakeTab()
      opened.push(tab)
      return tab as never
    })
    return opened
  }

  it.for([
    {
      name: 'the purchase page is still open',
      closed: false,
      reuses: true,
      tabs: 1
    },
    {
      name: 'the purchase page was closed',
      closed: true,
      reuses: true,
      tabs: 2
    },
    {
      name: 'the last page is not one to reuse',
      closed: false,
      reuses: false,
      tabs: 2
    }
  ])(
    'opens $tabs page(s) across two reservations when $name',
    ({ closed, reuses, tabs }) => {
      const opened = stubOpenTabs()
      const reserve = reserveSinglePurchaseTab(() => reuses)

      reserve()?.navigate(checkoutUrl)
      opened[0].closed = closed
      const again = reserve()
      again?.navigate('https://billing.comfy.org/v1/top-up?n=2')
      again?.close()

      expect(opened).toHaveLength(tabs)
      expect(opened[0].location.href).toBe(checkoutUrl)
      expect(opened[0].close).not.toHaveBeenCalled()
      expect(opened[0].focus.mock.calls.length > 0).toBe(tabs === 1)
    }
  )

  it('sends the reused tab back to the purchase page after its Back left it on this app', () => {
    const opened = stubOpenTabs()
    const reserve = reserveSinglePurchaseTab(() => true)

    reserve()?.navigate(checkoutUrl)
    opened[0].location = {
      href: window.location.href,
      origin: window.location.origin
    }
    reserve()?.navigate(checkoutUrl)

    expect(opened).toHaveLength(1)
    expect(opened[0].location.href).toBe(checkoutUrl)
    expect(opened[0].focus).toHaveBeenCalled()
  })
})
