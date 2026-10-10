import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'

const managerOrigin = 'https://utm-link-manager.pages.dev'
class CampaignLinkError extends Error {}

export function campaignFailureMessage(error: unknown) {
  return error instanceof CampaignLinkError
    ? error.message
    : 'Campaign link run failed. Check authentication and the manager before rerunning.'
}

const verticals = [
  ['vfx', 'VFX', 'vfx'],
  ['advertising', 'Advertising', 'advertising'],
  ['film-animation', 'Film and animation', 'film_animation'],
  ['architectural-visualization', 'Architectural visualization', 'archviz']
] as const

export function buildCampaignLinks({
  vertical = 'all',
  track = 'all',
  version = 'all',
  source = 'linkedin',
  creative = 'sizzle_video_01',
  audience = ''
} = {}) {
  if (!['all', ...verticals.map(([route]) => route)].includes(vertical))
    throw new CampaignLinkError('Unknown vertical')
  if (!['all', 'comfy-led', 'agency-led'].includes(track))
    throw new CampaignLinkError('Unknown campaign type')
  if (!['all', 'v1', 'v2'].includes(version))
    throw new CampaignLinkError('Unknown page version')
  for (const value of [source, creative, audience]) {
    if (!/^[a-z0-9_]*$/.test(value))
      throw new CampaignLinkError(
        'Tracking values must use lowercase letters, digits or underscores'
      )
  }
  if (!source || !creative)
    throw new CampaignLinkError('Source and creative are required')

  return verticals
    .filter(([route]) => vertical === 'all' || vertical === route)
    .flatMap(([route, label, campaignSlug]) =>
      ['comfy-led', 'agency-led']
        .filter((type) => track === 'all' || track === type)
        .flatMap((type) =>
          (route === 'vfx' ? ['v1', 'v2'] : ['v1'])
            .filter(
              (pageVersion) => version === 'all' || version === pageVersion
            )
            .map((pageVersion) => {
              const campaign = `${type === 'comfy-led' ? 'comfy' : 'agency'}_${campaignSlug}`
              const prefix = type === 'agency-led' ? 'agency-led/' : ''
              const suffix = pageVersion === 'v2' ? '/v2' : ''
              const baseUrl = `https://comfy.org/${prefix}${route}${suffix}/`
              const url = new URL(baseUrl)
              url.search = new URLSearchParams({
                utm_source: source,
                utm_medium: 'ads',
                utm_campaign: campaign,
                utm_content: creative,
                ...(audience && { utm_term: audience })
              }).toString()
              const fullUrl = url.href
              return {
                id: `campaign-${createHash('sha256').update(canonicalUrl(fullUrl)).digest('hex').slice(0, 24)}`,
                title: `${label} · ${type} · ${pageVersion} · ${creative}`,
                baseUrl,
                fullUrl,
                source,
                medium: 'ads',
                campaign,
                content: creative,
                contentTag: creative,
                nicheTag: '',
                term: audience,
                shortAlias: '',
                shortLink: '',
                useCustomAlias: false,
                status: 'pending',
                isDeleted: false,
                createdAt: new Date().toISOString(),
                custom_fields: {},
                note: 'Draft campaign link. Page launch approvals still required.'
              }
            })
        )
    )
}

type CampaignLink = ReturnType<typeof buildCampaignLinks>[number]

function canonicalUrl(value: string) {
  const url = new URL(value)
  url.searchParams.sort()
  url.hash = ''
  return url.href
}

function parseRegisteredLinks(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('links' in value) ||
    !Array.isArray(value.links)
  )
    throw new CampaignLinkError('UTM Manager returned an invalid link list')
  return value.links.map((item: unknown) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('id' in item) ||
      typeof item.id !== 'string' ||
      !('fullUrl' in item) ||
      typeof item.fullUrl !== 'string'
    )
      throw new CampaignLinkError('UTM Manager returned an invalid link record')
    return { id: item.id, fullUrl: item.fullUrl }
  })
}

export async function syncCampaignLinks(
  requested: CampaignLink[],
  {
    token,
    apply = false,
    request = fetch
  }: {
    token: string
    apply?: boolean
    request?: typeof fetch
  }
) {
  if (!token.trim())
    throw new CampaignLinkError(
      'UTM Manager automation credential is not configured'
    )
  async function api(path: string, method = 'GET', body?: unknown) {
    const response = await request(`${managerOrigin}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok)
      throw new CampaignLinkError(
        `UTM Manager ${method} ${path} failed (${response.status})`
      )
    const result: unknown = await response.json()
    return result
  }
  const registered = parseRegisteredLinks(await api('/links'))
  const known = new Set(registered.map(({ fullUrl }) => canonicalUrl(fullUrl)))
  const unique = [
    ...new Map(
      requested.map((link) => [canonicalUrl(link.fullUrl), link])
    ).values()
  ]
  const missing = unique.filter(
    ({ fullUrl }) => !known.has(canonicalUrl(fullUrl))
  )
  if (apply && missing.length) {
    await api('/links-batch', 'POST', { action: 'create', links: missing })
    const saved = parseRegisteredLinks(await api('/links'))
    const savedUrls = new Set(saved.map(({ fullUrl }) => canonicalUrl(fullUrl)))
    if (missing.some(({ fullUrl }) => !savedUrls.has(canonicalUrl(fullUrl))))
      throw new CampaignLinkError(
        'Some drafts could not be verified. Check the manager before rerunning.'
      )
  }
  return {
    mode: apply ? 'create-drafts' : 'check',
    requested: unique.length,
    skipped: unique.length - missing.length,
    created: apply ? missing.length : 0,
    missing: apply ? [] : missing.map(({ fullUrl }) => fullUrl),
    links: unique.map(({ title, fullUrl, campaign }) => ({
      title,
      fullUrl,
      campaign
    }))
  }
}

function linksFromEnvironment() {
  return buildCampaignLinks({
    vertical: process.env.CAMPAIGN_VERTICAL || 'all',
    track: process.env.CAMPAIGN_TRACK || 'all',
    version: process.env.CAMPAIGN_VERSION || 'all',
    source: process.env.CAMPAIGN_SOURCE || 'linkedin',
    creative: process.env.CAMPAIGN_CREATIVE || 'sizzle_video_01',
    audience: process.env.CAMPAIGN_AUDIENCE || ''
  })
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string', default: 'preview' },
      output: { type: 'string' }
    }
  })
  if (!['preview', 'check', 'create-drafts'].includes(values.mode))
    throw new CampaignLinkError('Mode must be preview, check or create-drafts')
  const links = linksFromEnvironment()
  if (!links.length)
    throw new CampaignLinkError(
      'No pages match these filters; v2 is available for VFX only'
    )
  const report =
    values.mode === 'preview'
      ? {
          mode: 'preview',
          duplicateCheck: 'not-run',
          links: links.map(({ title, fullUrl, campaign }) => ({
            title,
            fullUrl,
            campaign
          }))
        }
      : await syncCampaignLinks(links, {
          token: process.env.UTM_MANAGER_TOKEN || '',
          apply: values.mode === 'create-drafts'
        })
  const output = JSON.stringify(report, null, 2) + '\n'
  if (values.output) await writeFile(values.output, output)
  process.stdout.write(output)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(campaignFailureMessage(error))
    process.exitCode = 1
  })
}
