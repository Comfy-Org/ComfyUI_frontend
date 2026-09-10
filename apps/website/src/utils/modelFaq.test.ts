import { describe, expect, it } from 'vitest'
import type { Model } from '../config/models'
import { buildModelFaqs, modelFaqJsonLd } from './modelFaq'

const localModel: Model = {
  slug: 'local-model',
  name: 'local_model',
  displayName: 'Local Model',
  directory: 'diffusion_models',
  huggingFaceUrl: 'https://huggingface.co/local',
  docsUrl: 'https://docs.comfy.org/local',
  featured: false,
  workflowCount: 1
}

const cloudModel: Model = {
  ...localModel,
  slug: 'cloud-model',
  name: 'cloud_model',
  displayName: 'Cloud Model',
  directory: 'partner_nodes',
  huggingFaceUrl: '',
  docsUrl: undefined,
  workflowCount: 3
}

describe('model FAQs', () => {
  it('uses the visible FAQ array unchanged in JSON-LD', () => {
    const faqs = buildModelFaqs(localModel)
    const jsonLd = modelFaqJsonLd(faqs, 'https://comfy.org/model#faq')

    expect(jsonLd.mainEntity).toEqual(
      faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer }
      }))
    )
  })

  it('uses singular workflow copy with docs', () => {
    const faqs = buildModelFaqs(localModel)

    expect(faqs[1].answer).toContain('the community workflow template')
    expect(faqs[1].answer).not.toContain('templates')
    expect(faqs[2].answer).toContain('There is 1 community workflow template')
  })

  it('uses plural cloud-only copy without claiming local inference', () => {
    const faqs = buildModelFaqs(cloudModel)

    expect(faqs[1].answer).toContain('3 community workflow templates')
    expect(faqs[2].answer).toContain('There are 3')
    expect(faqs[3].answer).toContain('exclusively on Comfy Cloud')
    expect(faqs[3].answer).not.toContain('local inference')
  })

  it('localizes questions, descriptions, and cloud-only pricing', () => {
    const faqs = buildModelFaqs(cloudModel, 'zh-CN')

    expect(faqs[0].question).toBe('什么是 Cloud Model？')
    expect(faqs[0].answer).toContain('云端 API 模型')
    expect(faqs[1].question).toBe('如何在 ComfyUI 中使用 Cloud Model？')
    expect(faqs[3].answer).toContain('仅在 Comfy Cloud 上运行')
    expect(
      faqs.flatMap((faq) => [faq.question, faq.answer]).join(' ')
    ).not.toMatch(/\{\w+\}/)
  })
})
