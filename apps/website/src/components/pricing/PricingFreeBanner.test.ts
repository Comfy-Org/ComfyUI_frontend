import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import PricingFreeBanner from './PricingFreeBanner.vue'

// The apostrophe in the English title renders HTML-escaped, so assertions
// stop just before it.
const EN_TITLE_FRAGMENT = 'Start free. Upgrade when you'
const ZH_TITLE = '免费开始，准备好了再升级。'

function renderBanner(props: Record<string, unknown> = {}) {
  return renderToString(
    createSSRApp(PricingFreeBanner, {
      titleKey: 'pricing.banner.title',
      subtitleKey: 'pricing.banner.subtitle',
      cta: {
        labelKey: 'pricing.banner.cta',
        href: 'https://cloud.comfy.org',
        target: '_blank'
      },
      ...props
    })
  )
}

describe('PricingFreeBanner', () => {
  it('renders the English title, subtitle and CTA by default', async () => {
    const html = await renderBanner()

    expect(html).toContain(EN_TITLE_FRAGMENT)
    expect(html).toContain('no credit card required')
    expect(html).toContain('TRY FREE')
  })

  it('links the CTA to the given href in a new tab', async () => {
    const html = await renderBanner()

    expect(html).toContain('href="https://cloud.comfy.org"')
    expect(html).toContain('target="_blank"')
  })

  it('localizes every string when given the zh-CN locale', async () => {
    const html = await renderBanner({ locale: 'zh-CN' })

    expect(html).toContain(ZH_TITLE)
    expect(html).toContain('免费试用')
    expect(html).not.toContain(EN_TITLE_FRAGMENT)
  })
})
