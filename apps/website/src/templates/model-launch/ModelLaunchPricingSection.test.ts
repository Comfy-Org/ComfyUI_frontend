import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { minimaxPage } from '../../data/minimax'
import ModelLaunchPricingSection from './ModelLaunchPricingSection.vue'

describe('ModelLaunchPricingSection', () => {
  it('still renders the /minimax banner from its page config', async () => {
    const pricing = minimaxPage.pricing
    expect(pricing?.banner).toBeDefined()

    const html = await renderToString(
      createSSRApp(ModelLaunchPricingSection, { pricing })
    )

    expect(html).toContain('Start free. Upgrade when you')
    expect(html).toContain('5 free runs on real GPUs')
    expect(html).toContain('TRY FREE')
    expect(html).toContain('href="https://cloud.comfy.org"')
  })

  it('omits the banner when a page config does not define one', async () => {
    const html = await renderToString(
      createSSRApp(ModelLaunchPricingSection, {
        pricing: { defaultBillingCycle: 'monthly' }
      })
    )

    expect(html).not.toContain('TRY FREE')
    expect(html).toContain('Choose a plan')
  })
})
