/**
 * Announces a GitHub release in Slack as a short headline plus the full
 * changelog in thread replies.
 *
 * Moved here from Comfy-Org/Comfy-PR's `gh-frontend-release-notification` task,
 * which polled this repo's releases every five minutes and posted the whole
 * body inline. v1.56.1's notes are 89KB, so that landed as a wall of text plus
 * 25 thread replies in #frontend and crowded out the discussion the channel is
 * for. A release event is already a push, so the poll and its MongoDB dedup
 * collection are not needed on this side.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * Readability size, not a protocol limit — Slack's `text` cap is 40,000. Kept
 * at the value Comfy-PR used so threads look the same after the move.
 */
export const SLACK_CHUNK_CHAR_LIMIT = 3500

export interface ReleaseNotification {
  repo: string
  tagName: string
  htmlUrl: string
  body: string
  prerelease: boolean
}

export interface SlackChangelogPost {
  headline: string
  replies: string[]
}

export interface SlackMessage {
  text: string
  threadTs?: string
}

export interface SlackPoster {
  (message: SlackMessage): Promise<string>
}

const WHATS_CHANGED = /^##+\s*What's Changed\s*$/im
// `^##\s`, not `^##+\s`: GitHub emits `###` category subheadings inside What's
// Changed when a repo has a .github/release.yml, and ending the section at the
// first one would drop every entry under it from the counts.
const NEXT_SECTION = /^(?:##\s|\*\*Full Changelog\*\*)/m
const NEW_CONTRIBUTORS = /^##+\s*New Contributors\s*$/im
const PULL_URL = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)/g

/**
 * Slack reads `&`, `<` and `>` as control characters, so a PR title like
 * `fix: handle <div> nesting` would truncate the link it sits inside.
 */
function escapeSlackText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sectionAfter(body: string, heading: RegExp): string {
  const start = body.match(heading)
  if (start?.index === undefined) return ''
  const rest = body.slice(start.index + start[0].length)
  const end = rest.match(NEXT_SECTION)
  return end?.index === undefined ? rest : rest.slice(0, end.index)
}

/**
 * Counted over distinct pull URLs rather than list lines: the New Contributors
 * section repeats a PR that What's Changed already listed, and a plain line
 * count would report it twice.
 */
export function countMergedPullRequests(body: string): number {
  const section = sectionAfter(body, WHATS_CHANGED)
  const numbers = new Set(
    [...section.matchAll(PULL_URL)].map((match) => match[1])
  )
  return numbers.size
}

export function countNewContributors(body: string): number {
  const section = sectionAfter(body, NEW_CONTRIBUTORS)
  return section.split('\n').filter((line) => /^\s*[*-]\s+\S/.test(line)).length
}

/** Slack bold is one asterisk, GitHub's is two. */
function inline(text: string): string {
  return escapeSlackText(text).replace(/\*\*(.+?)\*\*/g, '*$1*')
}

export function toSlackMrkdwn(body: string): string {
  return body
    .split('\n')
    .map((line) => {
      const heading = /^#{1,6}\s+(.*?)\s*$/.exec(line)
      if (heading) return `*${inline(heading[1])}*`

      const item = /^\s*[*-]\s+(.*)$/.exec(line)
      if (item) {
        const authored = /^(.*?) by (@[^\s]+) in (https?:\/\/\S+)$/.exec(
          item[1]
        )
        if (authored) {
          return `• <${authored[3]}|${inline(authored[1])}> by ${inline(authored[2])}`
        }
        const linked = /^(.*?) in (https?:\/\/\S+)$/.exec(item[1])
        if (linked) {
          return `• <${linked[2]}|${inline(linked[1])}>`
        }
        return `• ${inline(item[1])}`
      }

      return inline(line)
    })
    .join('\n')
}

/**
 * Splits on whole lines so a changelog entry is never cut in half. A single
 * line longer than the limit is emitted on its own rather than broken.
 */
export function chunkByLines(text: string, limit: number): string[] {
  const chunks: string[] = []
  let current = ''

  for (const line of text.split('\n')) {
    const candidate = current === '' ? line : `${current}\n${line}`
    if (candidate.length <= limit) {
      current = candidate
      continue
    }
    if (current !== '') chunks.push(current)
    current = line
  }

  if (current.trim() !== '') chunks.push(current)
  return chunks
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function buildHeadline(
  release: ReleaseNotification,
  pullRequests: number,
  contributors: number,
  hasNotes: boolean
): string {
  const name = `${release.repo.split('/').pop() ?? release.repo} ${release.tagName}`
  const link = `<${release.htmlUrl}|${escapeSlackText(name)}>`
  const kind = release.prerelease ? 'is a pre-release' : 'is out'

  const counts = [
    pullRequests > 0 ? plural(pullRequests, 'merged PR') : '',
    contributors > 0 ? plural(contributors, 'new contributor') : ''
  ].filter(Boolean)

  const lead = counts.length
    ? `🎨 ${link} ${kind} — ${counts.join(', ')}.`
    : `🎨 ${link} ${kind}.`

  return hasNotes ? `${lead} Full changelog in this thread.` : lead
}

export function buildSlackChangelogPost(
  release: ReleaseNotification
): SlackChangelogPost {
  const body = release.body.trim()
  const headline = buildHeadline(
    release,
    countMergedPullRequests(body),
    countNewContributors(body),
    body !== ''
  )
  const replies = body
    ? chunkByLines(toSlackMrkdwn(body), SLACK_CHUNK_CHAR_LIMIT)
    : ['_No release notes._']

  return { headline, replies }
}

/**
 * `chat.postMessage` is Slack's special tier: roughly one message per second
 * per channel. A 623-PR release is 27 posts, so an unpaced burst is throttled,
 * not an edge case.
 */
export const SLACK_PACING_MS = 1100

export interface PostChangelogOptions {
  pacingMs?: number
  sleep?: (ms: number) => Promise<void>
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The headline is posted first and every chunk is a reply to it, so the channel
 * sees one short message however long the changelog is. Replies are sequential
 * because Slack orders a thread by arrival, not by request time.
 */
export async function postChangelog(
  post: SlackChangelogPost,
  send: SlackPoster,
  { pacingMs = SLACK_PACING_MS, sleep = wait }: PostChangelogOptions = {}
): Promise<string> {
  const parent = await send({ text: post.headline })
  for (const reply of post.replies) {
    if (pacingMs > 0) await sleep(pacingMs)
    await send({ text: reply, threadTs: parent })
  }
  return parent
}

export interface ChannelMessage {
  text?: string
  ts?: string
}

export interface HistoryPage {
  messages: ChannelMessage[]
  nextCursor?: string
}

/**
 * Finds an announcement for this release already in the channel.
 *
 * Un-publishing a release is deliberate practice here — `release-enforce-latest`
 * uses it to roll Latest back — and GitHub re-fires `published` on the way
 * back, so a republish would otherwise post a second headline and a second
 * full thread. Matching on the release URL rather than the tag because the URL
 * is what the headline links and cannot collide with a tag mentioned in prose.
 */
export async function findAnnouncement(
  releaseUrl: string,
  readPage: (cursor?: string) => Promise<HistoryPage>,
  maxPages = 3
): Promise<string | undefined> {
  // Not `includes`: the v1.56.1 URL is a prefix of the v1.56.10 one, so a
  // substring test would read v1.56.10's announcement as v1.56.1's and
  // suppress a release that was never posted. The tag has to end where the
  // URL does — `|` in Slack's <url|label>, or any other non-tag character.
  const announced = new RegExp(
    `${releaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`
  )

  let cursor: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const { messages, nextCursor } = await readPage(cursor)
    const hit = messages.find((message) => announced.test(message.text ?? ''))
    if (hit?.ts) return hit.ts
    if (!nextCursor) return undefined
    cursor = nextCursor
  }
  return undefined
}

interface SlackResponse {
  ok?: boolean
  ts?: string
  error?: string
}

export interface SlackPosterOptions {
  maxAttempts?: number
  sleep?: (ms: number) => Promise<void>
}

/** Slack sends `Retry-After` in seconds; this is the floor when it omits it. */
const RETRY_AFTER_FALLBACK_MS = 1000

function retryAfterMs(response: Response): number {
  const header = Number(response.headers.get('retry-after'))
  return Number.isFinite(header) && header > 0
    ? header * 1000
    : RETRY_AFTER_FALLBACK_MS
}

export function createSlackPoster(
  token: string,
  channel: string,
  { maxAttempts = 5, sleep = wait }: SlackPosterOptions = {}
): SlackPoster {
  return async ({ text, threadTs }) => {
    let lastError = 'no attempt was made'

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          channel,
          text,
          thread_ts: threadTs,
          unfurl_links: false,
          unfurl_media: false
        })
      })

      // A throttled call answers 429 with no JSON body at all, so this has to
      // come before the parse.
      if (response.status === 429) {
        lastError = 'ratelimited'
        // No point waiting out a Retry-After we will not act on.
        if (attempt < maxAttempts) await sleep(retryAfterMs(response))
        continue
      }

      // Slack answers 200 with {"ok":false} for auth and channel errors, so the
      // HTTP status alone would report a silent drop as a success.
      const payload = (await response.json()) as SlackResponse
      if (payload.ok && payload.ts) return payload.ts

      lastError = payload.error ?? `HTTP ${response.status}`
      if (lastError !== 'ratelimited') break
      if (attempt < maxAttempts) await sleep(retryAfterMs(response))
    }

    throw new Error(`Slack rejected chat.postMessage: ${lastError}`)
  }
}

interface HistoryResponse {
  ok?: boolean
  error?: string
  messages?: ChannelMessage[]
  response_metadata?: { next_cursor?: string }
}

export function createHistoryReader(
  token: string,
  channel: string
): (cursor?: string) => Promise<HistoryPage> {
  return async (cursor) => {
    const params = new URLSearchParams({ channel, limit: '200' })
    if (cursor) params.set('cursor', cursor)

    const response = await fetch(
      `https://slack.com/api/conversations.history?${params.toString()}`,
      { headers: { authorization: `Bearer ${token}` } }
    )
    const payload = (await response.json()) as HistoryResponse
    if (!payload.ok) {
      throw new Error(
        `Slack rejected conversations.history: ${payload.error ?? response.status}`
      )
    }
    return {
      messages: payload.messages ?? [],
      nextCursor: payload.response_metadata?.next_cursor || undefined
    }
  }
}

export function readRelease(env: NodeJS.ProcessEnv): ReleaseNotification {
  const repo = env.GITHUB_REPOSITORY
  const path = env.RELEASE_JSON
  if (!repo) throw new Error('GITHUB_REPOSITORY is required')
  if (!path) throw new Error('RELEASE_JSON is required')

  // Read from the file `gh api` wrote rather than from the environment: a
  // release body is up to ~90KB today and the whole environment block has to
  // fit in Linux's 128KB MAX_ARG_STRLEN, which would fail the step after this
  // one with "Argument list too long".
  const release = JSON.parse(readFileSync(path, 'utf8')) as {
    tag_name?: string
    html_url?: string
    body?: string | null
    prerelease?: boolean
  }

  if (!release.tag_name) throw new Error(`${path} has no tag_name`)
  if (!release.html_url) throw new Error(`${path} has no html_url`)

  return {
    repo,
    tagName: release.tag_name,
    htmlUrl: release.html_url,
    body: release.body ?? '',
    prerelease: release.prerelease === true
  }
}

/* c8 ignore start -- CLI entry, exercised by the workflow rather than a unit test */
async function main(): Promise<void> {
  const release = readRelease(process.env)
  const post = buildSlackChangelogPost(release)

  if (process.env.DRY_RUN === 'true') {
    console.log(`[headline]\n${post.headline}\n`)
    post.replies.forEach((reply, index) => {
      console.log(`[reply ${index + 1}/${post.replies.length}]\n${reply}\n`)
    })
    return
  }

  const token = process.env.SLACK_BOT_TOKEN ?? ''
  const channel = process.env.SLACK_CHANNEL_ID ?? ''

  // Degrades to posting rather than failing: the history read needs
  // channels:history, which chat:write does not imply, and a silent release is
  // worse than the duplicate this is here to avoid.
  const announced = await findAnnouncement(
    release.htmlUrl,
    createHistoryReader(token, channel)
  ).catch((error: unknown) => {
    console.warn(
      `Could not check for an existing announcement, posting anyway: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return undefined
  })

  if (announced) {
    console.log(
      `${release.tagName} was already announced (ts ${announced}); nothing to do.`
    )
    return
  }

  await postChangelog(post, createSlackPoster(token, channel))
  console.log(
    `Posted ${post.headline.length}-char headline with ${post.replies.length} thread replies.`
  )
}

// Not top-level await: that forces every consumer of this module into an ESM
// context, and a `tsx -e` import of it fails to transform at all.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
/* c8 ignore stop */
