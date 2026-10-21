import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { Crumb, JsonLdNode } from './jsonLd'
import { jsonLdId, organizationId } from './jsonLd'

const CREATORS_PATH = '/hub/creators/'

interface WorkflowPageJsonLdInput {
  model: {
    name: string
    summary?: string
    thumbnail?: { url: string; kind: 'image' | 'video' | 'audio' }
    catalogDetails?: { author?: string; authorUsername?: string }
  }
  useCaseLabel?: string
  url: string
  siteUrl: string
}

function creatorNode(
  siteUrl: string,
  details: WorkflowPageJsonLdInput['model']['catalogDetails']
): JsonLdNode | undefined {
  if (!details?.author || !details.authorUsername) return undefined
  const url = `${siteUrl}${CREATORS_PATH}${details.authorUsername.toLowerCase()}/`
  return {
    '@type': 'Person',
    '@id': jsonLdId(url, 'creator'),
    name: details.author,
    url
  }
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
  const creator = creatorNode(siteUrl, model.catalogDetails)
  const workflow: JsonLdNode = {
    '@type': 'SoftwareSourceCode',
    '@id': id,
    name: model.name,
    url,
    description: model.summary,
    image: model.thumbnail?.kind === 'image' ? model.thumbnail.url : undefined,
    genre: useCaseLabel,
    runtimePlatform: 'ComfyUI',
    ...(creator ? { author: { '@id': creator['@id'] } } : {}),
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
    extraJsonLd: creator ? [workflow, creator] : [workflow]
  }
}
