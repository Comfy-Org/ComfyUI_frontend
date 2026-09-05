import { describe, expect, it } from 'vitest'

import { jsonLdId } from '../../utils/jsonLd'
import { cliFaqs } from './faqs'
import { cliPageJsonLd } from './jsonLd'

const siteUrl = 'https://comfy.org'

describe('cliPageJsonLd', () => {
  it('shapes the English page graph around the software node', () => {
    const url = 'https://comfy.org/cli/'
    const { softwareId, nodes } = cliPageJsonLd(siteUrl, url, 'en')

    expect(softwareId).toBe(jsonLdId(url, 'software'))
    expect(softwareId).toMatch(/#software$/)

    const [software, faq] = nodes
    expect(software).toMatchObject({
      '@type': 'SoftwareApplication',
      '@id': softwareId,
      name: 'Comfy CLI',
      url,
      applicationCategory: 'DeveloperApplication'
    })
    expect(typeof software.operatingSystem).toBe('string')

    expect(faq['@type']).toBe('FAQPage')
    expect(faq.mainEntity).toHaveLength(10)
  })

  it('builds the FAQPage questions from the zh strings for zh-CN', () => {
    const url = 'https://comfy.org/zh-CN/cli/'
    const { nodes } = cliPageJsonLd(siteUrl, url, 'zh-CN')
    const [zhFirst] = cliFaqs('zh-CN')
    const [enFirst] = cliFaqs('en')

    expect(zhFirst.question).not.toBe(enFirst.question)
    expect(nodes[1].mainEntity).toMatchObject(
      cliFaqs('zh-CN').map(({ question }) => ({ name: question }))
    )
  })
})
