import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { localModels } from '@/config/local-models'
import { translationsFor } from '@/i18n/translations'
import ModelHeroSection from './ModelHeroSection.vue'

const { t } = translationsFor('en')
const modelsBySlug = new Map(localModels.map((model) => [model.slug, model]))

const familyPages = [
  ['flux1-dev', 'flux'],
  ['flux1-schnell', 'flux'],
  ['flux1-dev-kontext-fp8-scaled', 'flux'],
  ['flux1-fill-dev', 'flux'],
  ['flux-2-klein-base-9b-fp8', 'flux'],
  ['ace-step-v1-3-5b', 'ace-step'],
  ['hidream-i1-dev-fp8', 'hidream'],
  ['omnigen2-fp16', 'omnigen'],
  ['sd-xl-base-1-0', 'sdxl'],
  ['z-image-bf16', 'z-image'],
  ['z-image-turbo-bf16', 'z-image'],
  ['svd-xt', 'svd'],
  ['ltx-2-19b-dev-fp8', 'ltx'],
  ['ltx-2-19b-distilled', 'ltx'],
  ['qwen-image-fp8-e4m3fn', 'qwen'],
  ['qwen-image-edit-2509-fp8-e4m3fn', 'qwen']
] as const

describe('ModelHeroSection', () => {
  it.for(familyPages)(
    'links the %s page to the Hub search for %s',
    ([slug, term]) => {
      const model = modelsBySlug.get(slug)
      if (!model) throw new Error(`${slug} has no live model page`)

      render(ModelHeroSection, {
        props: {
          displayName: model.displayName,
          huggingFaceUrl: model.huggingFaceUrl,
          hubSearch: model.hubSearch,
          workflowCount: model.workflowCount,
          directory: model.directory
        }
      })

      expect(
        screen
          .getByRole('link', { name: t('models.hero.primaryCta') })
          .getAttribute('href')
      ).toBe(`https://comfy.org/hub/workflows/?q=${encodeURIComponent(term)}`)
    }
  )
})
