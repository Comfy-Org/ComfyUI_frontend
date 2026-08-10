import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import CloudPricingSection from './CloudPricingSection.vue'

describe('CloudPricingSection', () => {
  it('renders the free-tier banner inside the pricing section', async () => {
    const html = await renderToString(createSSRApp(CloudPricingSection))

    expect(html).toContain('Start free. Upgrade when you')
    expect(html).toContain('href="https://cloud.comfy.org"')
    expect(html).toContain('target="_blank"')
    // The banner sits alongside the plan cards, not instead of them.
    expect(html).toContain('Choose a plan')
  })

  it('localizes the banner for the zh-CN page', async () => {
    const html = await renderToString(
      createSSRApp(CloudPricingSection, { locale: 'zh-CN' })
    )

    expect(html).toContain('免费开始，准备好了再升级。')
    expect(html).not.toContain('Start free. Upgrade when you')
  })
})
