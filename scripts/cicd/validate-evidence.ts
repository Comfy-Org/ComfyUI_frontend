import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

type EvidenceKind = 'issue' | 'pr'

type EventPayload = {
  issue?: { body?: string | null }
  pull_request?: { body?: string | null }
}

export type PullRequestEvidencePayload = {
  body?: string | null
  number?: number | null
}

export type ScreencastProbe = (url: string) => Promise<boolean>

export type MediaResponse = {
  headers: { get(name: string): string | null }
  ok: boolean
  status: number
}

export type MediaRequest = (
  url: string,
  init: {
    headers?: Record<string, string>
    method: 'GET' | 'HEAD'
    redirect: 'manual'
  }
) => Promise<MediaResponse>

export type EvidenceValidation = {
  errors: string[]
  valid: boolean
}

const EMPTY_VALUE = /^(?:-|n\/a|none|not applicable|tbd|todo)$/i

function clean(value: string): string {
  return stripHtmlCommentsOutsideFences(value).trim()
}

function spaces(value: string): string {
  return value.replace(/[^\r\n]/g, ' ')
}

function maskHtmlComments(
  value: string,
  startsInsideComment: boolean
): { masked: string; remainsInsideComment: boolean } {
  const masked = value.split('')
  let inComment = startsInsideComment
  let offset = 0

  while (offset < value.length) {
    if (inComment) {
      const end = value.indexOf('-->', offset)
      const stop = end === -1 ? value.length : end + 3
      masked.fill(' ', offset, stop)
      offset = stop
      if (end === -1) break
      inComment = false
      continue
    }

    const start = value.indexOf('<!--', offset)
    if (start === -1) break
    masked.fill(' ', start, start + 4)
    offset = start + 4
    inComment = true
  }

  return { masked: masked.join(''), remainsInsideComment: inComment }
}

function maskHiddenHeadingRegions(body: string): string {
  let inComment = false
  let fence: { character: '`' | '~'; length: number } | null = null

  return body
    .split(/(?<=\n)/)
    .map((line) => {
      const ending = line.endsWith('\r\n')
        ? '\r\n'
        : line.endsWith('\n')
          ? '\n'
          : ''
      const content = ending ? line.slice(0, -ending.length) : line

      if (fence) {
        const closing = new RegExp(
          `^ {0,3}\\${fence.character}{${fence.length},}[ \\t]*$`
        ).test(content)
        if (closing) fence = null
        return `${spaces(content)}${ending}`
      }

      const commentResult = maskHtmlComments(content, inComment)
      inComment = commentResult.remainsInsideComment
      const opening = commentResult.masked.match(/^ {0,3}(`{3,}|~{3,})/)
      if (opening) {
        const marker = opening[1]
        fence = {
          character: marker[0] as '`' | '~',
          length: marker.length
        }
        return `${spaces(content)}${ending}`
      }

      return `${commentResult.masked}${ending}`
    })
    .join('')
}

function stripHtmlCommentsOutsideFences(body: string): string {
  let inComment = false
  let fence: { character: '`' | '~'; length: number } | null = null

  return body
    .split(/(?<=\n)/)
    .map((line) => {
      const ending = line.endsWith('\r\n')
        ? '\r\n'
        : line.endsWith('\n')
          ? '\n'
          : ''
      const content = ending ? line.slice(0, -ending.length) : line

      if (fence) {
        const closing = new RegExp(
          `^ {0,3}\\${fence.character}{${fence.length},}[ \\t]*$`
        ).test(content)
        if (closing) fence = null
        return line
      }

      const commentResult = maskHtmlComments(content, inComment)
      inComment = commentResult.remainsInsideComment
      const opening = commentResult.masked.match(/^ {0,3}(`{3,}|~{3,})/)
      if (opening) {
        const marker = opening[1]
        fence = {
          character: marker[0] as '`' | '~',
          length: marker.length
        }
      }
      return `${commentResult.masked}${ending}`
    })
    .join('')
}

function section(body: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headingSearch = maskHiddenHeadingRegions(body)
  const match = new RegExp(
    `^ {0,3}#{2,6}[ \\t]+${escapedHeading}[ \\t]*#*[ \\t]*(?:\\r?\\n|$)`,
    'im'
  ).exec(headingSearch)
  if (!match) return ''

  const contentStart = match.index + match[0].length
  const nextHeading = /^ {0,3}#{2,6}[ \t]+/gm
  nextHeading.lastIndex = contentStart
  const nextMatch = nextHeading.exec(headingSearch)
  return clean(body.slice(contentStart, nextMatch?.index ?? body.length))
}

function hasContent(value: string): boolean {
  const content = clean(value)
    .replace(/^\s*(?:[-*+]\s*|\d+\.\s*)$/gm, '')
    .replace(/^\s*```[\w-]*\s*$/gm, '')
    .trim()

  return content.length >= 4 && !EMPTY_VALUE.test(content)
}

function hasProcedure(value: string): boolean {
  const content = clean(value)
  if (!hasContent(content)) return false

  const listedSteps = content
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line))
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').trim())
    .filter((line) => line.length >= 4 && !EMPTY_VALUE.test(line))

  if (listedSteps.length >= 2) return true

  const words = content.match(/[\p{L}\p{N}_-]+/gu) ?? []
  return content.length >= 20 && words.length >= 5
}

function isGitHubAttachmentUrl(host: string, path: string): boolean {
  return (
    host === 'github.com' &&
    /^\/user-attachments\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      path
    )
  )
}

function isOpaqueGitHubAttachmentUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      isGitHubAttachmentUrl(
        url.hostname.toLowerCase(),
        url.pathname.toLowerCase()
      )
    )
  } catch {
    return false
  }
}

function isLoomUrl(host: string, path: string): boolean {
  return (
    (host === 'loom.com' || host === 'www.loom.com') &&
    path.startsWith('/share/')
  )
}

function isVisualMediaUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    const path = url.pathname.toLowerCase()

    return (
      isGitHubAttachmentUrl(host, path) ||
      host === 'user-images.githubusercontent.com' ||
      /\.(?:gif|jpe?g|mov|mp4|png|webm|webp)$/.test(path) ||
      isLoomUrl(host, path)
    )
  } catch {
    return false
  }
}

function isExplicitScreencastUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    const path = url.pathname.toLowerCase()
    return /\.(?:gif|mov|mp4|webm)$/.test(path) || isLoomUrl(host, path)
  } catch {
    return false
  }
}

function isAllowedGitHubMediaHost(host: string): boolean {
  return (
    host === 'github.com' ||
    host === 'user-images.githubusercontent.com' ||
    host.endsWith('.githubusercontent.com') ||
    /^github-production-user-asset-[a-z0-9-]+\.s3\.amazonaws\.com$/.test(host)
  )
}

function isRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status)
}

function redirectMediaVerdict(url: URL): boolean | null {
  const hintedContentType =
    url.searchParams.get('response-content-type')?.toLowerCase() ?? ''
  if (
    hintedContentType.startsWith('video/') ||
    hintedContentType === 'image/gif'
  ) {
    return true
  }
  if (hintedContentType.startsWith('image/')) return false

  const path = url.pathname.toLowerCase()
  if (/\.(?:gif|mov|mp4|webm)$/.test(path)) return true
  if (/\.(?:jpe?g|png|webp)$/.test(path)) return false
  return null
}

function isVerifiedScreencastResponse(
  url: URL,
  response: MediaResponse
): boolean {
  const contentType =
    response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase() ?? ''
  if (contentType.startsWith('video/') || contentType === 'image/gif') {
    return true
  }

  return (
    (!contentType || contentType === 'application/octet-stream') &&
    /\.(?:gif|mov|mp4|webm)$/.test(url.pathname.toLowerCase())
  )
}

export async function probeGitHubScreencast(
  rawUrl: string,
  request: MediaRequest = async (url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
): Promise<boolean> {
  if (!isOpaqueGitHubAttachmentUrl(rawUrl)) return false

  let current = new URL(rawUrl)
  for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
    if (
      current.protocol !== 'https:' ||
      current.username ||
      current.password ||
      !isAllowedGitHubMediaHost(current.hostname.toLowerCase())
    ) {
      return false
    }

    let response = await request(current.href, {
      headers: { Accept: '*/*' },
      method: 'HEAD',
      redirect: 'manual'
    })
    if (
      response.status === 405 ||
      response.status === 501 ||
      (response.status === 403 && redirectCount > 0)
    ) {
      response = await request(current.href, {
        headers: { Accept: '*/*', Range: 'bytes=0-0' },
        method: 'GET',
        redirect: 'manual'
      })
    }

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get('location')
      if (!location) return false
      const redirected = new URL(location, current)
      if (
        redirected.protocol !== 'https:' ||
        redirected.username ||
        redirected.password ||
        !isAllowedGitHubMediaHost(redirected.hostname.toLowerCase())
      ) {
        return false
      }
      const redirectVerdict = redirectMediaVerdict(redirected)
      if (redirectVerdict !== null) return redirectVerdict
      current = redirected
      continue
    }

    return response.ok && isVerifiedScreencastResponse(current, response)
  }

  return false
}

function isStandaloneScreencastLink(content: string, link: string): boolean {
  const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `^\\s*(?:Screencast:\\s*)?(?:${escaped}|\\[[^\\]]+\\]\\(${escaped}\\))\\s*$`,
    'im'
  ).test(content)
}

function opaqueScreencastUrls(value: string): string[] {
  const content = clean(value)
  const links = content.match(/https?:\/\/[^\s)>]+/gi) ?? []
  return links
    .map((rawLink) => rawLink.replace(/[),.;]+$/, ''))
    .filter(
      (link) =>
        isOpaqueGitHubAttachmentUrl(link) &&
        isStandaloneScreencastLink(content, link)
    )
}

function hasScreencastEvidence(
  value: string,
  verifiedOpaqueUrls: ReadonlySet<string> = new Set()
): boolean {
  const content = clean(value)
  const links = content.match(/https?:\/\/[^\s)>]+/gi) ?? []
  for (const rawLink of links) {
    const link = rawLink.replace(/[),.;]+$/, '')
    if (isExplicitScreencastUrl(link)) return true
    try {
      const url = new URL(link)
      if (
        !isGitHubAttachmentUrl(
          url.hostname.toLowerCase(),
          url.pathname.toLowerCase()
        )
      ) {
        continue
      }
      if (
        isStandaloneScreencastLink(content, link) &&
        verifiedOpaqueUrls.has(canonicalMediaUrl(link))
      ) {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

function canonicalMediaUrl(rawUrl: string): string {
  const url = new URL(rawUrl)
  url.hash = ''
  url.search = ''
  url.hostname = url.hostname.toLowerCase()
  try {
    url.pathname = decodeURIComponent(url.pathname)
  } catch {
    // Keep malformed percent encoding unchanged; URL parsing already succeeded.
  }
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }
  return url.href
}

function visualMediaUrls(value: string): string[] {
  const links = clean(value).match(/https?:\/\/[^\s)>]+/gi) ?? []
  return links.filter(isVisualMediaUrl)
}

function hasIssueVisualEvidence(
  value: string,
  verifiedOpaqueUrls: ReadonlySet<string> = new Set()
): boolean {
  const urls = visualMediaUrls(value)
  if (urls.some(isExplicitScreencastUrl)) return true

  const labeledUrl = (
    label: string,
    accepts: (url: string) => boolean
  ): string => {
    const match = clean(value).match(
      new RegExp(`^\\s*(?:Or\\s+)?${label}:\\s*(.+)$`, 'im')
    )
    const url = visualMediaUrls(match?.[1] ?? '')[0] ?? ''
    return accepts(url) ? url : ''
  }
  const labeledScreencast = clean(value).match(
    /^\s*(?:Or\s+)?Screencast:\s*(.+)$/im
  )?.[1]
  if (
    labeledScreencast &&
    hasScreencastEvidence(labeledScreencast, verifiedOpaqueUrls)
  ) {
    return true
  }

  const before = labeledUrl('Before', isVisualMediaUrl)
  const after = labeledUrl('After', isVisualMediaUrl)
  return Boolean(
    before && after && canonicalMediaUrl(before) !== canonicalMediaUrl(after)
  )
}

function hasTestOrLogEvidence(value: string): boolean {
  const evidence = clean(value)
  if (!hasContent(evidence) || evidence.length < 16) return false

  const command =
    /\b(?:bun|deno|npm|npx|playwright|pnpm|pytest|tox|vitest|yarn)\b/i.test(
      evidence
    )
  const outcome =
    /\b(?:exit(?:ed)?\s+(?:code\s+)?\d+|fail(?:ed|ure)?|pass(?:ed)?|success(?:ful)?|timeout)\b/i.test(
      evidence
    )
  const logExcerpt =
    /(?:^|\n)\s*(?:error|exception|failure|status)\s*[:=]|\b(?:stack trace|status\s+[1-5]\d\d)\b/i.test(
      evidence
    )
  const linkedEvidence =
    /\b(?:ci|log|test)\b/i.test(evidence) && /https?:\/\/\S+/i.test(evidence)

  return (command && outcome) || logExcerpt || linkedEvidence
}

function issueReproduction(body: string): string {
  return (
    section(body, 'Steps to Reproduce') ||
    section(body, 'Concrete example or steps')
  )
}

function nonVisualIssueEvidence(value: string): boolean {
  const evidence = clean(value)
  const reason = evidence.match(/^N\/A:\s*(.+)$/im)?.[1] ?? ''
  const testOrLog =
    evidence.match(/^Test\/log evidence:\s*([\s\S]*)$/im)?.[1] ?? ''
  return hasContent(reason) && hasTestOrLogEvidence(testOrLog)
}

function validateIssueEvidenceWithVerifiedMedia(
  body: string,
  verifiedOpaqueUrls: ReadonlySet<string>
): EvidenceValidation {
  const errors: string[] = []
  const mode = section(body, 'Evidence type').toLowerCase()
  const evidence = section(body, 'Evidence')

  if (!hasProcedure(issueReproduction(body))) {
    errors.push('Add concrete reproduction steps or an example.')
  }

  if (mode !== 'visual' && mode !== 'non-visual') {
    errors.push('Select exactly one evidence type: Visual or Non-visual.')
  } else if (
    mode === 'visual' &&
    !hasIssueVisualEvidence(evidence, verifiedOpaqueUrls)
  ) {
    errors.push(
      'Visual issues require distinct before and after links or a screencast.'
    )
  } else if (mode === 'non-visual' && !nonVisualIssueEvidence(evidence)) {
    errors.push(
      'Non-visual issues require an N/A rationale and test/log evidence.'
    )
  }

  return { errors, valid: errors.length === 0 }
}

export function validateIssueEvidence(body: string): EvidenceValidation {
  return validateIssueEvidenceWithVerifiedMedia(body, new Set())
}

function selectedPrModes(body: string): string[] {
  const mode = section(body, 'Evidence type')
  return ['Visual', 'Non-visual'].filter((value) =>
    new RegExp(`^\\s*[-*]\\s+\\[[xX]\\]\\s+${value}\\s*$`, 'im').test(mode)
  )
}

function validatePullRequestEvidenceWithVerifiedMedia(
  body: string,
  verifiedOpaqueUrls: ReadonlySet<string>
): EvidenceValidation {
  const errors: string[] = []
  const selectedModes = selectedPrModes(body)

  if (!hasProcedure(section(body, 'Reproduction or validation steps'))) {
    errors.push('Add reproduction or validation steps.')
  }

  if (selectedModes.length !== 1) {
    errors.push('Check exactly one evidence type: Visual or Non-visual.')
  } else if (selectedModes[0] === 'Visual') {
    const before = visualMediaUrls(section(body, 'Before'))[0]
    const after = visualMediaUrls(section(body, 'After'))[0]
    const hasBeforeAndAfter = Boolean(
      before && after && canonicalMediaUrl(before) !== canonicalMediaUrl(after)
    )
    const hasScreencast = hasScreencastEvidence(
      section(body, 'Screencast'),
      verifiedOpaqueUrls
    )
    if (!hasBeforeAndAfter && !hasScreencast) {
      errors.push(
        'Visual pull requests require before and after links or a screencast.'
      )
    }
  } else {
    const rationale = section(body, 'Non-visual rationale')
    const reason = rationale.match(/^N\/A:\s*([\s\S]*)$/i)?.[1] ?? ''
    if (!hasContent(reason)) {
      errors.push('Non-visual pull requests require an N/A rationale.')
    }
    if (!hasTestOrLogEvidence(section(body, 'Test or log evidence'))) {
      errors.push('Non-visual pull requests require test or log evidence.')
    }
  }

  return { errors, valid: errors.length === 0 }
}

export function validatePullRequestEvidence(body: string): EvidenceValidation {
  return validatePullRequestEvidenceWithVerifiedMedia(body, new Set())
}

async function verifiedOpaqueScreencasts(
  value: string,
  probe: ScreencastProbe
): Promise<Set<string>> {
  const verified = new Set<string>()
  for (const url of opaqueScreencastUrls(value)) {
    try {
      if (await probe(url)) verified.add(canonicalMediaUrl(url))
    } catch {
      // Probe errors fail closed by leaving the attachment unverified.
    }
  }
  return verified
}

export async function validateIssueEvidenceWithMedia(
  body: string,
  probe: ScreencastProbe = probeGitHubScreencast
): Promise<EvidenceValidation> {
  const verified = await verifiedOpaqueScreencasts(
    section(body, 'Evidence'),
    probe
  )
  return validateIssueEvidenceWithVerifiedMedia(body, verified)
}

export async function validatePullRequestEvidenceWithMedia(
  body: string,
  probe: ScreencastProbe = probeGitHubScreencast
): Promise<EvidenceValidation> {
  const verified = await verifiedOpaqueScreencasts(
    section(body, 'Screencast'),
    probe
  )
  return validatePullRequestEvidenceWithVerifiedMedia(body, verified)
}

export async function validatePullRequestEvidenceBatch(
  pullRequests: PullRequestEvidencePayload[],
  probe: ScreencastProbe = probeGitHubScreencast
): Promise<EvidenceValidation> {
  if (pullRequests.length === 0) {
    return {
      errors: [
        'No pull request metadata was available for evidence validation.'
      ],
      valid: false
    }
  }

  const errors: string[] = []
  for (const pullRequest of pullRequests) {
    const result = await validatePullRequestEvidenceWithMedia(
      pullRequest.body ?? '',
      probe
    )
    if (!result.valid) {
      const prefix = pullRequest.number ? `PR #${pullRequest.number}: ` : ''
      errors.push(...result.errors.map((error) => `${prefix}${error}`))
    }
  }
  return { errors, valid: errors.length === 0 }
}

async function runCli(): Promise<void> {
  const [kind, eventPath] = process.argv.slice(2)
  if ((kind !== 'issue' && kind !== 'pr') || !eventPath) {
    throw new Error('Usage: validate-evidence.ts <issue|pr> <event.json>')
  }

  const payload = JSON.parse(readFileSync(eventPath, 'utf8')) as EventPayload
  const body =
    kind === 'issue' ? payload.issue?.body : payload.pull_request?.body
  const result = await validateEvidence(kind, body ?? '')

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `valid=${result.valid}\nerrors=${JSON.stringify(result.errors)}\n`
    )
  }

  if (result.valid) {
    process.stdout.write('Evidence contract satisfied.\n')
    return
  }

  result.errors.forEach((error) => console.error(`::error::${error}`))
  process.exitCode = 1
}

async function validateEvidence(
  kind: EvidenceKind,
  body: string
): Promise<EvidenceValidation> {
  return kind === 'issue'
    ? validateIssueEvidenceWithMedia(body)
    : validatePullRequestEvidenceWithMedia(body)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli().catch((error: unknown) => {
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, 'valid=false\nerrors=[]\n')
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error(`::error::${message}`)
    process.exitCode = 1
  })
}
