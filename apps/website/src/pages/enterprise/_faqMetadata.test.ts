import { describe, expect, it } from 'vitest'

import { buildFaqPageNode } from './_faqMetadata'

describe('buildFaqPageNode', () => {
  it('maps visible FAQ copy into plain-text structured data', () => {
    expect(
      buildFaqPageNode('https://comfy.org/enterprise/', [
        {
          question: 'Where can I review the controls?',
          answer:
            'Review the [Comfy Trust Center](https://trust.comfy.org) for current controls.'
        }
      ])
    ).toEqual({
      '@type': 'FAQPage',
      '@id': 'https://comfy.org/enterprise/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Where can I review the controls?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Review the Comfy Trust Center for current controls.'
          }
        }
      ]
    })
  })
})
