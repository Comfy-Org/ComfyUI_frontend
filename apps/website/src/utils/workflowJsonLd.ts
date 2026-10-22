import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import { cleanSummary } from '@/lib/workshop/model-meta-description'
import type { Crumb, JsonLdNode } from './jsonLd'
import { jsonLdId, organizationId } from './jsonLd'

interface WorkflowPageJsonLdInput {
  model: {
    name: string
    summary?: string
    thumbnail?: { url: string; kind: 'image' | 'video' | 'audio' }
  }
  useCaseLabel?: string
  url: string
  siteUrl: string
}

export function workflowPageJsonLd({
  model,
  useCaseLabel,
  url,
  siteUrl
}: WorkflowPageJsonLdInput): {
  pageType: 'WebPage'
  mainEntityId: string
  breadcrumbs: Crumb[]
  extraJsonLd: JsonLdNode[]
} {
  const id = jsonLdId(url, 'workflow')
  const workflow: JsonLdNode = {
    '@type': 'SoftwareSourceCode',
    '@id': id,
    name: model.name,
    url,
    description: cleanSummary(model.summary),
    image: model.thumbnail?.kind === 'image' ? model.thumbnail.url : undefined,
    genre: useCaseLabel,
    runtimePlatform: 'ComfyUI',
    publisher: { '@id': organizationId(siteUrl) },
    mainEntityOfPage: url
  }
  return {
    pageType: 'WebPage',
    mainEntityId: id,
    breadcrumbs: [
      { name: t('breadcrumb.home'), url: `${siteUrl}/` },
      {
        name: t('workshop.hub.workflows'),
        url: `${siteUrl}${getRoutes().hubWorkflows}`
      },
      { name: model.name }
    ],
    extraJsonLd: [workflow]
  }
}
