import type { Model } from '../config/models'
import { t } from '../i18n/translations'
import type { Locale, TranslationKey } from '../i18n/translations'
import type { JsonLdNode } from './jsonLd'
import { getFaqPricingAnswer, getWhatIsDescription } from './modelSeoCopy'

export interface ModelFaq {
  readonly id: string
  readonly question: string
  readonly answer: string
}

const dirDescriptionKeys: Record<Model['directory'], TranslationKey> = {
  diffusion_models: 'models.dirDescription.diffusion_models',
  checkpoints: 'models.dirDescription.checkpoints',
  loras: 'models.dirDescription.loras',
  controlnet: 'models.dirDescription.controlnet',
  clip_vision: 'models.dirDescription.clip_vision',
  vae: 'models.dirDescription.vae',
  text_encoders: 'models.dirDescription.text_encoders',
  audio_encoders: 'models.dirDescription.audio_encoders',
  upscale_models: 'models.dirDescription.upscale_models',
  latent_upscale_models: 'models.dirDescription.latent_upscale_models',
  style_models: 'models.dirDescription.style_models',
  model_patches: 'models.dirDescription.model_patches',
  partner_nodes: 'models.dirDescription.partner_nodes',
  geometry_estimation: 'models.dirDescription.geometry_estimation',
  background_removal: 'models.dirDescription.background_removal',
  detection: 'models.dirDescription.detection',
  frame_interpolation: 'models.dirDescription.frame_interpolation',
  optical_flow: 'models.dirDescription.optical_flow'
}

function fill(
  template: string,
  values: Readonly<Record<string, string>>
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  )
}

export function buildModelFaqs(
  model: Model,
  locale: Locale = 'en'
): readonly ModelFaq[] {
  const values = {
    name: model.displayName,
    count: String(model.workflowCount)
  }
  const templates = fill(
    t(
      model.workflowCount === 1
        ? 'models.faq.templates.singular'
        : 'models.faq.templates.plural',
      locale
    ),
    values
  )
  const howToUse = fill(
    t(
      model.docsUrl
        ? 'models.faq.howToUse.withDocs'
        : 'models.faq.howToUse.withoutDocs',
      locale
    ),
    { ...values, templates, url: model.docsUrl ?? '' }
  )

  return [
    {
      id: 'what-is',
      question: fill(t('models.faq.whatIs.question', locale), values),
      answer: getWhatIsDescription(
        model,
        t(
          dirDescriptionKeys[model.directory] ??
            'models.dirDescription.default',
          locale
        ),
        locale
      )
    },
    {
      id: 'how-to-use',
      question: fill(t('models.faq.howToUse.question', locale), values),
      answer: howToUse
    },
    {
      id: 'workflow-count',
      question: fill(t('models.faq.workflowCount.question', locale), values),
      answer: fill(
        t(
          model.workflowCount === 1
            ? 'models.faq.workflowCount.singular'
            : 'models.faq.workflowCount.plural',
          locale
        ),
        values
      )
    },
    {
      id: 'is-free',
      question: fill(t('models.faq.isFree.question', locale), values),
      answer: getFaqPricingAnswer(model, locale)
    }
  ]
}

export function modelFaqJsonLd(
  faqs: readonly ModelFaq[],
  id: string
): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': id,
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer }
    }))
  }
}
