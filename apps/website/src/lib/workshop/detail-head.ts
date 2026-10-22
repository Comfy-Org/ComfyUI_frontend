import { modelDeveloper } from '@/config/model-vendors'
import type { Locale } from '@/i18n/translations'
import { modelPageJsonLd } from '@/utils/modelJsonLd'
import { workflowPageJsonLd } from '@/utils/workflowJsonLd'
import {
  modelMetaDescription,
  workflowMetaDescription
} from './model-meta-description'
import { modelTitle, workflowTitle } from './model-title'

interface DetailPage {
  model: {
    name: string
    summary?: string
    provider?: string
    workflowId?: string
    thumbnail?: { url: string; kind: 'image' | 'video' | 'audio' }
  }
  useCaseLabel?: string
  priceEstimate?: string
}

export function detailPageHead(
  page: DetailPage,
  url: string,
  siteUrl: string,
  locale?: Locale
) {
  const { model } = page
  if (model.workflowId !== undefined)
    return {
      title: workflowTitle(model, locale),
      description: workflowMetaDescription(model, locale),
      jsonLd: workflowPageJsonLd({
        model,
        useCaseLabel: page.useCaseLabel,
        url,
        siteUrl,
        locale
      })
    }
  return {
    title: modelTitle(model, locale),
    description: modelMetaDescription(page, locale),
    jsonLd: modelPageJsonLd({
      model,
      useCaseLabel: page.useCaseLabel,
      url,
      siteUrl,
      developer: modelDeveloper(model.provider)
    })
  }
}
