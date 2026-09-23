import { describe, expect, it } from 'vitest'

import { qwenImage21Page } from './qwenImage21'

const T2I_TEMPLATE =
  'https://cloud.comfy.org/?template=image_qwen_image_2_1_t2i&utm_source=comfy.org&utm_medium=referral&utm_campaign=qwen-image-2-1'
const EDIT_TEMPLATE =
  'https://cloud.comfy.org/?template=image_qwen_image_2_1_image_edit&utm_source=comfy.org&utm_medium=referral&utm_campaign=qwen-image-2-1'

function faqAnswer(id: string) {
  const item = qwenImage21Page.faq?.items.find((faq) => faq.id === id)
  if (!item) throw new Error(`missing FAQ ${id}`)
  return item.answer
}

describe('qwenImage21Page', () => {
  it('sends the RUN button, every gallery card and the pricing banner to the text-to-image template', () => {
    expect(qwenImage21Page.hero.primaryCta?.href).toBe(T2I_TEMPLATE)
    expect(qwenImage21Page.pricing?.banner?.cta.href).toBe(T2I_TEMPLATE)
    expect(qwenImage21Page.gallery?.cards.map((card) => card.href)).toEqual(
      Array(6).fill(T2I_TEMPLATE)
    )
  })

  it.for(['en', 'zh-CN'] as const)(
    'links both Cloud templates from the %s Q&A',
    (locale) => {
      expect(faqAnswer('how-to-use')[locale]).toContain(T2I_TEMPLATE)
      expect(faqAnswer('reference-images')[locale]).toContain(EDIT_TEMPLATE)
    }
  )

  it.for(['en', 'zh-CN'] as const)(
    'gives every gallery card a %s prompt to copy',
    (locale) => {
      const prompts = qwenImage21Page.gallery?.cards.map(
        (card) => card.prompt?.[locale]
      )
      expect(prompts).toHaveLength(6)
      expect(prompts?.every((prompt) => prompt && prompt.trim())).toBe(true)
    }
  )
})
