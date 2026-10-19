import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'

const managerOrigin = 'https://utm-link-manager.pages.dev'
class CampaignLinkError extends Error {}

export function campaignFailureMessage(error: unknown) {
  if (error instanceof CampaignLinkError) return error.message
  const kind = error instanceof Error ? error.name : typeof error
  return `Campaign link run failed (${kind}). Check the inputs and the run log before rerunning.`
}

const destinations = [
  {
    vertical: 'vfx',
    label: 'VFX',
    track: 'comfy-led',
    version: 'v2',
    campaign: 'comfy_vfx',
    baseUrl: 'https://comfy.org/solutions/vfx/'
  },
  {
    vertical: 'vfx',
    label: 'VFX',
    track: 'agency-led',
    version: 'v1',
    campaign: 'agency_vfx',
    baseUrl: 'https://comfy.org/agency-led/vfx/'
  },
  {
    vertical: 'vfx',
    label: 'VFX',
    track: 'agency-led',
    version: 'v2',
    campaign: 'agency_vfx',
    baseUrl: 'https://comfy.org/agency-led/vfx/v2/'
  },
  {
    vertical: 'advertising',
    label: 'Advertising',
    track: 'agency-led',
    version: 'v1',
    campaign: 'agency_advertising',
    baseUrl: 'https://comfy.org/agency-led/advertising/'
  },
  {
    vertical: 'film-animation',
    label: 'Film and animation',
    track: 'agency-led',
    version: 'v1',
    campaign: 'agency_film_animation',
    baseUrl: 'https://comfy.org/agency-led/film-animation/'
  },
  {
    vertical: 'architectural-visualization',
    label: 'Architectural visualization',
    track: 'agency-led',
    version: 'v1',
    campaign: 'agency_archviz',
    baseUrl: 'https://comfy.org/agency-led/architectural-visualization/'
  }
] as const

type Destination = (typeof destinations)[number]
export type CampaignMode = 'preview' | 'check' | 'create-drafts'
type CampaignFilters = {
  vertical?: 'all' | Destination['vertical']
  track?: 'all' | Destination['track']
  version?: 'all' | Destination['version']
  source?: string
  creative?: string
  audience?: string
}

function parseChoice<const T extends string>(
  value: string | undefined,
  choices: readonly T[],
  message: string
): T | undefined {
  if (!value) return undefined
  const match = choices.find((choice) => choice === value)
  if (!match) throw new CampaignLinkError(message)
  return match
}

export function buildCampaignLinks({
  vertical = 'all',
  track = 'all',
  version = 'all',
  source = 'linkedin',
  creative = 'sizzle_video_01',
  audience = ''
}: CampaignFilters = {}) {
  for (const value of [source, creative, audience]) {
    if (!/^[a-z0-9_]*$/.test(value))
      throw new CampaignLinkError(
        'Tracking values must use lowercase letters, digits or underscores'
      )
  }
  if (!source || !creative)
    throw new CampaignLinkError('Source and creative are required')

  return destinations
    .filter(
      (page) =>
        (vertical === 'all' || vertical === page.vertical) &&
        (track === 'all' || track === page.track) &&
        (version === 'all' || version === page.version)
    )
    .map((page) => {
      const url = new URL(page.baseUrl)
      url.search = new URLSearchParams({
        utm_source: source,
        utm_medium: 'ads',
        utm_campaign: page.campaign,
        utm_content: creative,
        ...(audience && { utm_term: audience })
      }).toString()
      const fullUrl = url.href
      return {
        id: `campaign-${createHash('sha256').update(canonicalUrl(fullUrl)).digest('hex').slice(0, 24)}`,
        title: `${page.label} · ${page.track} · ${page.version} · ${creative}`,
        baseUrl: page.baseUrl,
        fullUrl,
        source,
        medium: 'ads',
        campaign: page.campaign,
        content: creative,
        contentTag: creative,
        nicheTag: '',
        term: audience,
        custom_fields: {},
        note: 'Draft campaign link. Page launch approvals still required.'
      }
    })
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
      !('fullUrl' in item) ||
      typeof item.fullUrl !== 'string'
    )
      throw new CampaignLinkError('UTM Manager returned an invalid link record')
    return { fullUrl: item.fullUrl }
  })
}

function parseValidationIssues(value: unknown) {
  if (!Array.isArray(value))
    throw new CampaignLinkError(
      'UTM Manager returned invalid validation issues'
    )
  return value.map((item: unknown) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('code' in item) ||
      typeof item.code !== 'string' ||
      !('message' in item) ||
      typeof item.message !== 'string'
    )
      throw new CampaignLinkError(
        'UTM Manager returned an invalid validation issue'
      )
    return { code: item.code, message: item.message }
  })
}

function parseValidation(value: unknown, links: CampaignLink[]) {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('results' in value) ||
    !Array.isArray(value.results) ||
    value.results.length !== links.length
  )
    throw new CampaignLinkError(
      'UTM Manager returned an invalid validation report'
    )
  return value.results.map((item: unknown, index: number) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('index' in item) ||
      item.index !== index ||
      !('errors' in item) ||
      !('warnings' in item) ||
      !('existingLinks' in item) ||
      !Array.isArray(item.existingLinks)
    )
      throw new CampaignLinkError(
        'UTM Manager returned an invalid validation result'
      )
    return {
      fullUrl: links[index].fullUrl,
      errors: parseValidationIssues(item.errors),
      warnings: parseValidationIssues(item.warnings),
      existingMatches: item.existingLinks.length
    }
  })
}

export async function syncCampaignLinks(
  requested: CampaignLink[],
  {
    token,
    mode = 'check'
  }: {
    token: string
    mode?: Exclude<CampaignMode, 'preview'>
  }
) {
  if (!token.trim())
    throw new CampaignLinkError(
      'UTM Manager automation credential is not configured'
    )
  async function api(path: string, body?: unknown): Promise<unknown> {
    const method = body === undefined ? 'GET' : 'POST'
    const response = await fetch(`${managerOrigin}/api${path}`, {
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
    return response.json()
  }
  const registered = parseRegisteredLinks(await api('/links'))
  const known = new Set(registered.map(({ fullUrl }) => canonicalUrl(fullUrl)))
  const missing = requested.filter(
    ({ fullUrl }) => !known.has(canonicalUrl(fullUrl))
  )
  const validation = missing.length
    ? parseValidation(await api('/links/validate', { links: missing }), missing)
    : []
  const requiresReview = validation.some(
    ({ errors, existingMatches }) => errors.length > 0 || existingMatches > 0
  )
  const creating = mode === 'create-drafts' && !requiresReview
  const creationFailures: { fullUrl: string; message: string }[] = []
  const savedUrls = new Set<string>()
  if (creating && missing.length) {
    for (const link of missing) {
      try {
        await api('/links-batch', { action: 'create', links: [link] })
      } catch (error) {
        creationFailures.push({
          fullUrl: link.fullUrl,
          message: campaignFailureMessage(error)
        })
      }
    }
    const saved = parseRegisteredLinks(await api('/links'))
    for (const { fullUrl } of saved) savedUrls.add(canonicalUrl(fullUrl))
  }
  const unverified = missing.filter(
    ({ fullUrl }) => !savedUrls.has(canonicalUrl(fullUrl))
  )
  return {
    requested: requested.length,
    skipped: requested.length - missing.length,
    created: creating ? missing.length - unverified.length : 0,
    missing: unverified.map(({ fullUrl }) => fullUrl),
    requiresReview: requiresReview || (creating && unverified.length > 0),
    validation,
    creationFailures
  }
}

function linksFromEnvironment() {
  return buildCampaignLinks({
    vertical: parseChoice(
      process.env.CAMPAIGN_VERTICAL,
      ['all', ...destinations.map((page) => page.vertical)],
      'Unknown vertical'
    ),
    track: parseChoice(
      process.env.CAMPAIGN_TRACK,
      ['all', ...destinations.map((page) => page.track)],
      'Unknown campaign track'
    ),
    version: parseChoice(
      process.env.CAMPAIGN_VERSION,
      ['all', ...destinations.map((page) => page.version)],
      'Unknown page version'
    ),
    source: process.env.CAMPAIGN_SOURCE || undefined,
    creative: process.env.CAMPAIGN_CREATIVE || undefined,
    audience: process.env.CAMPAIGN_AUDIENCE || undefined
  })
}

export async function runCampaignLinks(mode: CampaignMode) {
  const requested = linksFromEnvironment()
  if (!requested.length)
    throw new CampaignLinkError('No destinations match these campaign filters')
  const links = requested.map(({ title, fullUrl, campaign }) => ({
    title,
    fullUrl,
    campaign
  }))
  return mode === 'preview'
    ? { mode, duplicateCheck: 'not-run', links }
    : {
        mode,
        links,
        ...(await syncCampaignLinks(requested, {
          token: process.env.UTM_MANAGER_TOKEN || '',
          mode
        }))
      }
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      mode: { type: 'string', default: 'preview' },
      output: { type: 'string' }
    }
  })
  const mode =
    parseChoice(
      values.mode,
      ['preview', 'check', 'create-drafts'],
      'Mode must be preview, check or create-drafts'
    ) ?? 'preview'
  const report = await runCampaignLinks(mode)
  const output = JSON.stringify(report, null, 2) + '\n'
  if (values.output) await writeFile(values.output, output)
  process.stdout.write(output)
  if ('requiresReview' in report && report.requiresReview) process.exitCode = 1
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
