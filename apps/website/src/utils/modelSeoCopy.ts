import type { Model } from '../config/models'
import { t } from '../i18n/translations'
import type { Locale } from '../i18n/translations'

function isCloudOnly(model: Model): boolean {
  return !model.huggingFaceUrl
}

export function getWhatIsDescription(
  model: Model,
  dirDesc: string,
  locale: Locale = 'en'
): string {
  return t(
    isCloudOnly(model)
      ? 'models.faq.whatIs.cloudAnswer'
      : 'models.faq.whatIs.localAnswer',
    locale
  )
    .replaceAll('{name}', model.displayName)
    .replace('{description}', dirDesc)
    .replace('{count}', String(model.workflowCount))
}

export function getPageDescription(model: Model): string {
  if (isCloudOnly(model)) {
    return `Run ${model.displayName} in ComfyUI. ${model.workflowCount} community workflow templates and step-by-step tutorials.`
  }
  return `Run ${model.displayName} in ComfyUI with full parameter control. ${model.workflowCount} community workflow templates, step-by-step tutorials, and free local inference.`
}

export function getFaqPricingAnswer(
  model: Model,
  locale: Locale = 'en'
): string {
  return t(
    isCloudOnly(model)
      ? 'models.faq.isFree.cloudAnswer'
      : 'models.faq.isFree.localAnswer',
    locale
  ).replace('{name}', model.displayName)
}
