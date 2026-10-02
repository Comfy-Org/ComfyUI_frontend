import { describe, expect, it } from 'vitest'

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
  postChangelog,
  readReleaseFromEnv,
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

    const parent = await postChangelog(post, async (message) => {
      sent.push(message)
      return sent.length === 1 ? '1700000000.000100' : '1700000000.000200'
    })

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
      }
    )

    expect(order).toEqual(['h', 'a', 'b', 'c'])
  })
})

describe('readReleaseFromEnv', () => {
  it('reads the fields the workflow exports', () => {
    expect(
      readReleaseFromEnv({
        GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
        RELEASE_TAG: 'v1.54.12',
        RELEASE_URL: 'https://example.com/tag',
        RELEASE_BODY: 'notes',
        RELEASE_PRERELEASE: 'true'
      })
    ).toEqual({
      repo: 'Comfy-Org/ComfyUI_frontend',
      tagName: 'v1.54.12',
      htmlUrl: 'https://example.com/tag',
      body: 'notes',
      prerelease: true
    })
  })

  it('treats a missing body as empty rather than failing the release', () => {
    expect(
      readReleaseFromEnv({
        GITHUB_REPOSITORY: 'o/r',
        RELEASE_TAG: 'v1',
        RELEASE_URL: 'https://example.com'
      }).body
    ).toBe('')
  })

  it('fails loudly when an identifying field is missing', () => {
    expect(() =>
      readReleaseFromEnv({ GITHUB_REPOSITORY: 'o/r', RELEASE_TAG: 'v1' })
    ).toThrow('RELEASE_URL is required')
  })
})
