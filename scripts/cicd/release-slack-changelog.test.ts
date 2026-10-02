import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import type {
  ReleaseNotification,
  SlackMessage
} from './release-slack-changelog'
import {
  SLACK_CHUNK_CHAR_LIMIT,
  buildSlackChangelogPost,
  chunkByLines,
  countMergedPullRequests,
  countNewContributors,
  createSlackPoster,
  postChangelog,
  readRelease,
  toSlackMrkdwn
} from './release-slack-changelog'

const PR = 'https://github.com/Comfy-Org/ComfyUI_frontend/pull'

/** Verbatim shape of a real v1.54.12 release body. */
const REAL_BODY = [
  "## What's Changed",
  `* [backport core/1.54] feat(agent): run the free-use messaging experiment (#19712) by @christian-byrne in ${PR}/19838`,
  `* [backport core/1.54] fix(agent): reconcile a hydrated streaming turn by @christian-byrne in ${PR}/19848`,
  `* 1.54.12 by @comfy-pr-bot in ${PR}/19917`,
  '',
  '',
  '**Full Changelog**: https://github.com/Comfy-Org/ComfyUI_frontend/compare/v1.54.11...v1.54.12'
].join('\n')

function release(overrides: Partial<ReleaseNotification> = {}) {
  return {
    repo: 'Comfy-Org/ComfyUI_frontend',
    tagName: 'v1.54.12',
    htmlUrl: `https://github.com/Comfy-Org/ComfyUI_frontend/releases/tag/v1.54.12`,
    body: REAL_BODY,
    prerelease: false,
    ...overrides
  }
}

function bodyWithPullRequests(count: number): string {
  const lines = ["## What's Changed"]
  for (let i = 1; i <= count; i++) {
    lines.push(`* fix: change number ${i} by @someone in ${PR}/${20000 + i}`)
  }
  return lines.join('\n')
}

describe('countMergedPullRequests', () => {
  it("counts the What's Changed entries", () => {
    expect(countMergedPullRequests(REAL_BODY)).toBe(3)
  })

  it('does not double-count a PR the New Contributors section repeats', () => {
    const body = [
      "## What's Changed",
      `* feat: a thing by @newbie in ${PR}/100`,
      `* fix: another by @veteran in ${PR}/101`,
      '',
      '## New Contributors',
      `* @newbie made their first contribution in ${PR}/100`,
      '',
      '**Full Changelog**: https://example.com/compare'
    ].join('\n')

    expect(countMergedPullRequests(body)).toBe(2)
  })

  it("is zero when there is no What's Changed section", () => {
    expect(countMergedPullRequests('Hand-written notes, no list.')).toBe(0)
  })
})

describe('countNewContributors', () => {
  it('counts only the New Contributors list', () => {
    const body = [
      "## What's Changed",
      `* feat: a thing by @newbie in ${PR}/100`,
      `* fix: another by @alsonew in ${PR}/101`,
      '',
      '## New Contributors',
      `* @newbie made their first contribution in ${PR}/100`,
      `* @alsonew made their first contribution in ${PR}/101`
    ].join('\n')

    expect(countNewContributors(body)).toBe(2)
  })

  it('is zero when the section is absent', () => {
    expect(countNewContributors(REAL_BODY)).toBe(0)
  })
})

describe('toSlackMrkdwn', () => {
  it('links each entry on its pull request and keeps the author readable', () => {
    expect(toSlackMrkdwn(`* fix: a thing by @someone in ${PR}/42`)).toBe(
      `• <${PR}/42|fix: a thing> by @someone`
    )
  })

  it('converts headings and bold to Slack mrkdwn', () => {
    expect(toSlackMrkdwn("## What's Changed")).toBe("*What's Changed*")
    expect(toSlackMrkdwn('**Full Changelog**: https://x/y')).toBe(
      '*Full Changelog*: https://x/y'
    )
  })

  it('escapes characters Slack would read as control characters', () => {
    // An unescaped `>` closes the surrounding <url|text> link and swallows the
    // rest of the line.
    expect(
      toSlackMrkdwn(`* fix: handle <div> & <span> by @dev in ${PR}/7`)
    ).toBe(`• <${PR}/7|fix: handle &lt;div&gt; &amp; &lt;span&gt;> by @dev`)
  })

  it('leaves an entry without a trailing URL as a plain bullet', () => {
    expect(toSlackMrkdwn('* a note with no link')).toBe('• a note with no link')
  })
})

describe('chunkByLines', () => {
  it('never splits a line across chunks', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `entry ${i} `.repeat(10))
    const chunks = chunkByLines(lines.join('\n'), 400)

    expect(chunks.join('\n').split('\n')).toEqual(lines)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(400)
  })

  it('emits an over-long single line on its own rather than breaking it', () => {
    const long = 'x'.repeat(50)
    const chunks = chunkByLines(`short\n${long}\nshort`, 10)

    expect(chunks).toEqual(['short', long, 'short'])
  })

  it('returns nothing for blank input', () => {
    expect(chunkByLines('', 100)).toEqual([])
    expect(chunkByLines('\n  \n', 100)).toEqual([])
  })
})

describe('buildSlackChangelogPost', () => {
  it('keeps the headline to two sentences with the counts and the link', () => {
    const { headline } = buildSlackChangelogPost(release())

    expect(headline).toBe(
      '🎨 <https://github.com/Comfy-Org/ComfyUI_frontend/releases/tag/v1.54.12|ComfyUI_frontend v1.54.12> is out — 3 merged PRs. Full changelog in this thread.'
    )
    expect(headline.split(/[.!?](?:\s|$)/).filter(Boolean)).toHaveLength(2)
  })

  it('keeps every changelog entry out of the headline and in the replies', () => {
    const { headline, replies } = buildSlackChangelogPost(release())

    expect(headline).not.toContain('backport core/1.54')
    for (const pull of ['19838', '19848', '19917']) {
      expect(replies.join('\n')).toContain(`${PR}/${pull}`)
    }
  })

  it('posts the largest real release as one short headline plus replies', () => {
    // v1.56.1's body is ~89KB — the case that produced a wall of text plus 25
    // thread replies in #frontend.
    const body = bodyWithPullRequests(110)
    const { headline, replies } = buildSlackChangelogPost(release({ body }))

    expect(headline).toContain('110 merged PRs')
    expect(headline.length).toBeLessThan(200)
    for (const chunk of replies) {
      expect(chunk.length).toBeLessThanOrEqual(SLACK_CHUNK_CHAR_LIMIT)
    }
    const posted = replies.join('\n')
    for (let i = 1; i <= 110; i++) {
      expect(posted).toContain(`${PR}/${20000 + i}`)
    }
  })

  it('names a pre-release as one', () => {
    const { headline } = buildSlackChangelogPost(
      release({ tagName: 'v1.57.0-rc.1', prerelease: true })
    )

    expect(headline).toContain('is a pre-release')
  })

  it('reports singular counts without an s', () => {
    const body = [
      "## What's Changed",
      `* feat: only change by @newbie in ${PR}/1`,
      '## New Contributors',
      `* @newbie made their first contribution in ${PR}/1`
    ].join('\n')

    expect(buildSlackChangelogPost(release({ body })).headline).toContain(
      '1 merged PR, 1 new contributor.'
    )
  })

  it('still posts something when the release has no notes', () => {
    const { headline, replies } = buildSlackChangelogPost(release({ body: '' }))

    expect(headline).toContain('is out.')
    expect(replies).toEqual(['_No release notes._'])
  })
})

describe('postChangelog', () => {
  it('threads every chunk under the headline', async () => {
    const sent: SlackMessage[] = []
    const post = {
      headline: 'headline',
      replies: ['one', 'two', 'three']
    }

    const parent = await postChangelog(
      post,
      async (message) => {
        sent.push(message)
        return sent.length === 1 ? '1700000000.000100' : '1700000000.000200'
      },
      { pacingMs: 0 }
    )

    expect(parent).toBe('1700000000.000100')
    expect(sent[0]).toEqual({ text: 'headline' })
    expect(sent.slice(1)).toEqual([
      { text: 'one', threadTs: '1700000000.000100' },
      { text: 'two', threadTs: '1700000000.000100' },
      { text: 'three', threadTs: '1700000000.000100' }
    ])
  })

  it('keeps the replies in changelog order', async () => {
    const order: string[] = []
    await postChangelog(
      { headline: 'h', replies: ['a', 'b', 'c'] },
      async ({ text }) => {
        order.push(text)
        return '1.1'
      },
      { pacingMs: 0 }
    )

    expect(order).toEqual(['h', 'a', 'b', 'c'])
  })

  it('paces the replies but not the headline', async () => {
    // chat.postMessage allows ~1 message/second/channel, and a large release
    // is 27 posts.
    const slept: number[] = []
    await postChangelog(
      { headline: 'h', replies: ['a', 'b'] },
      async () => '1.1',
      {
        pacingMs: 1100,
        sleep: async (ms) => {
          slept.push(ms)
        }
      }
    )

    expect(slept).toEqual([1100, 1100])
  })
})

describe('createSlackPoster', () => {
  function stubFetch(
    responses: {
      status?: number
      headers?: Record<string, string>
      body?: unknown
    }[]
  ) {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    let index = 0
    vi.stubGlobal(
      'fetch',
      async (
        url: string,
        init: { body: string; headers: Record<string, string> }
      ) => {
        calls.push({
          url,
          body: JSON.parse(init.body) as Record<string, unknown>
        })
        const next = responses[Math.min(index++, responses.length - 1)]
        return {
          status: next.status ?? 200,
          headers: new Headers(next.headers ?? {}),
          json: async () => next.body
        }
      }
    )
    return calls
  }

  it('sends the message Slack expects and returns its ts', async () => {
    const calls = stubFetch([{ body: { ok: true, ts: '1700000000.000100' } }])

    const ts = await createSlackPoster(
      'xoxb-tok',
      'C123'
    )({
      text: 'hello',
      threadTs: '1700000000.000001'
    })

    expect(ts).toBe('1700000000.000100')
    expect(calls[0].url).toBe('https://slack.com/api/chat.postMessage')
    expect(calls[0].body).toEqual({
      channel: 'C123',
      text: 'hello',
      thread_ts: '1700000000.000001',
      unfurl_links: false,
      unfurl_media: false
    })
  })

  it('treats HTTP 200 with ok:false as the failure it is', async () => {
    stubFetch([{ body: { ok: false, error: 'channel_not_found' } }])

    await expect(
      createSlackPoster('xoxb-tok', 'C123')({ text: 'x' })
    ).rejects.toThrow('Slack rejected chat.postMessage: channel_not_found')
  })

  it('retries a 429 after Retry-After and succeeds', async () => {
    // A throttled call has no JSON body, so a parse-first poster would crash
    // here instead of backing off.
    stubFetch([
      { status: 429, headers: { 'retry-after': '3' } },
      { body: { ok: true, ts: '1700000000.000200' } }
    ])
    const slept: number[] = []

    const ts = await createSlackPoster('xoxb-tok', 'C123', {
      sleep: async (ms) => {
        slept.push(ms)
      }
    })({ text: 'x' })

    expect(ts).toBe('1700000000.000200')
    expect(slept).toEqual([3000])
  })

  it('retries a ratelimited payload returned with HTTP 200', async () => {
    stubFetch([
      { body: { ok: false, error: 'ratelimited' } },
      { body: { ok: true, ts: '1700000000.000300' } }
    ])
    const slept: number[] = []

    const ts = await createSlackPoster('xoxb-tok', 'C123', {
      sleep: async (ms) => {
        slept.push(ms)
      }
    })({ text: 'x' })

    expect(ts).toBe('1700000000.000300')
    expect(slept).toEqual([1000])
  })

  it('gives up after maxAttempts rather than retrying forever', async () => {
    const calls = stubFetch([{ status: 429, headers: { 'retry-after': '1' } }])

    await expect(
      createSlackPoster('xoxb-tok', 'C123', {
        maxAttempts: 3,
        sleep: async () => {}
      })({ text: 'x' })
    ).rejects.toThrow('Slack rejected chat.postMessage: ratelimited')
    expect(calls).toHaveLength(3)
  })

  it('does not retry a non-rate-limit error', async () => {
    const calls = stubFetch([{ body: { ok: false, error: 'invalid_auth' } }])

    await expect(
      createSlackPoster('bad', 'C123', { sleep: async () => {} })({ text: 'x' })
    ).rejects.toThrow('invalid_auth')
    expect(calls).toHaveLength(1)
  })
})

describe('readRelease', () => {
  function releaseFile(contents: unknown): string {
    const path = join(mkdtempSync(join(tmpdir(), 'rel-')), 'release.json')
    writeFileSync(path, JSON.stringify(contents))
    return path
  }

  it('reads the release off disk rather than out of the environment', () => {
    const RELEASE_JSON = releaseFile({
      tag_name: 'v1.54.12',
      html_url: 'https://example.com/tag',
      body: 'notes',
      prerelease: true
    })

    expect(
      readRelease({
        GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
        RELEASE_JSON
      })
    ).toEqual({
      repo: 'Comfy-Org/ComfyUI_frontend',
      tagName: 'v1.54.12',
      htmlUrl: 'https://example.com/tag',
      body: 'notes',
      prerelease: true
    })
  })

  it('treats a null body as empty rather than failing the release', () => {
    const RELEASE_JSON = releaseFile({
      tag_name: 'v1',
      html_url: 'https://example.com',
      body: null
    })

    const release = readRelease({ GITHUB_REPOSITORY: 'o/r', RELEASE_JSON })
    expect(release.body).toBe('')
    expect(release.prerelease).toBe(false)
  })

  it('fails loudly when the payload is missing an identifying field', () => {
    const RELEASE_JSON = releaseFile({ html_url: 'https://example.com' })

    expect(() =>
      readRelease({ GITHUB_REPOSITORY: 'o/r', RELEASE_JSON })
    ).toThrow('has no tag_name')
  })

  it('fails loudly when the workflow did not point at a release file', () => {
    expect(() => readRelease({ GITHUB_REPOSITORY: 'o/r' })).toThrow(
      'RELEASE_JSON is required'
    )
  })
})
