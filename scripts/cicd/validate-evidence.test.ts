import { describe, expect, it, vi } from 'vitest'

import {
  probeGitHubScreencast,
  validateIssueEvidence,
  validateIssueEvidenceWithMedia,
  validatePullRequestEvidence,
  validatePullRequestEvidenceWithMedia
} from './validate-evidence'
import type { MediaResponse } from './validate-evidence'

function issueBody({
  evidence,
  heading = 'Steps to Reproduce',
  mode = 'Visual',
  reproduction = '1. Open ComfyUI\n2. Queue the workflow'
}: {
  evidence: string
  heading?: string
  mode?: string
  reproduction?: string
}): string {
  return `## ${heading}
${reproduction}

## Evidence type
${mode}

## Evidence
${evidence}`
}

function pullRequestBody({
  after = '',
  before = '',
  mode = 'Visual',
  rationale = '',
  screencast = '',
  steps = '1. Open the queue\n2. Reproduce the change',
  testEvidence = ''
}: {
  after?: string
  before?: string
  mode?: 'Both' | 'Neither' | 'Non-visual' | 'Visual'
  rationale?: string
  screencast?: string
  steps?: string
  testEvidence?: string
}): string {
  const visual = mode === 'Visual' || mode === 'Both' ? 'x' : ' '
  const nonVisual = mode === 'Non-visual' || mode === 'Both' ? 'x' : ' '
  return `## Reproduction or validation steps
${steps}

## Evidence type
- [${visual}] Visual
- [${nonVisual}] Non-visual

## Before
${before}

## After
${after}

## Screencast
${screencast}

## Non-visual rationale
${rationale}

## Test or log evidence
${testEvidence}`
}

function mediaResponse(
  status: number,
  headers: Record<string, string> = {}
): MediaResponse {
  const normalized = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  )
  return {
    headers: { get: (name) => normalized.get(name.toLowerCase()) ?? null },
    ok: status >= 200 && status < 300,
    status
  }
}

describe('validateIssueEvidence', () => {
  it('accepts visual evidence with reproduction steps', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'Before: https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111\nAfter: https://github.com/user-attachments/assets/22222222-2222-4222-8222-222222222222'
      })
    )
    expect(result.valid).toBe(true)
  })

  it('accepts standard GitHub markdown images for before and after', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'Before: ![before](https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111)\nAfter: ![after](https://github.com/user-attachments/assets/22222222-2222-4222-8222-222222222222)'
      })
    )

    expect(result.valid).toBe(true)
  })

  it('accepts one visual screencast', () => {
    const result = validateIssueEvidence(
      issueBody({ evidence: 'https://example.com/change.webm' })
    )
    expect(result.valid).toBe(true)
  })

  it('accepts a content-verified GitHub screencast attachment', async () => {
    const result = await validateIssueEvidenceWithMedia(
      issueBody({
        evidence:
          'Screencast: https://github.com/user-attachments/assets/77777777-7777-4777-8777-777777777777'
      }),
      vi.fn().mockResolvedValue(true)
    )

    expect(result.valid).toBe(true)
  })

  it('rejects a screenshot attachment labeled as an issue screencast', async () => {
    const result = await validateIssueEvidenceWithMedia(
      issueBody({
        evidence:
          'Screencast: https://github.com/user-attachments/assets/77777777-7777-4777-8777-777777777777'
      }),
      vi.fn().mockResolvedValue(false)
    )

    expect(result.valid).toBe(false)
  })

  it('accepts a non-visual rationale with test evidence', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'N/A: The failure is an API response.\nTest/log evidence: `pnpm test` reproduces the timeout.',
        heading: 'Concrete example or steps',
        mode: 'Non-visual'
      })
    )
    expect(result.valid).toBe(true)
  })

  it('rejects empty numbered reproduction steps', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'https://github.com/user-attachments/assets/33333333-3333-4333-8333-333333333333',
        reproduction: '1.\n2.\n3.'
      })
    )
    expect(result.errors).toContain(
      'Add concrete reproduction steps or an example.'
    )
  })

  it('rejects visual evidence without a link', () => {
    const result = validateIssueEvidence(
      issueBody({ evidence: 'The button is visibly broken.' })
    )
    expect(result.valid).toBe(false)
  })

  it('rejects a generic URL that is not visual media', () => {
    const result = validateIssueEvidence(
      issueBody({ evidence: 'https://example.com/evidence' })
    )
    expect(result.valid).toBe(false)
  })

  it('rejects one screenshot without before and after states', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'https://github.com/user-attachments/assets/44444444-4444-4444-8444-444444444444'
      })
    )
    expect(result.valid).toBe(false)
  })

  it('rejects two unlabeled screenshots because before and after are ambiguous', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'https://github.com/user-attachments/assets/55555555-5555-4555-8555-555555555555\nhttps://github.com/user-attachments/assets/66666666-6666-4666-8666-666666666666'
      })
    )
    expect(result.valid).toBe(false)
  })

  it('rejects non-visual evidence without tests or logs', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence: 'N/A: This changes internal state only.',
        mode: 'Non-visual'
      })
    )
    expect(result.valid).toBe(false)
  })

  it('rejects GitHub URLs outside the exact attachment asset path', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'Before: https://github.com/user-attachments/not-assets/before\nAfter: https://github.com/user-attachments/assets/after/extra'
      })
    )

    expect(result.valid).toBe(false)
  })

  it('rejects encoded path separators in GitHub attachment IDs', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'Before: https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111\nAfter: https://github.com/user-attachments/assets/22222222-2222-4222-8222-222222222222%2Fextra'
      })
    )

    expect(result.valid).toBe(false)
  })

  it('rejects a fabricated non-UUID GitHub attachment asset', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'Before: https://github.com/user-attachments/assets/before\nAfter: https://github.com/user-attachments/assets/after'
      })
    )

    expect(result.valid).toBe(false)
  })

  it('rejects an image URL labeled as a screencast', () => {
    const result = validateIssueEvidence(
      issueBody({ evidence: 'Screencast: https://example.com/change.png' })
    )

    expect(result.valid).toBe(false)
  })

  it('canonicalizes labeled before and after URLs before comparing them', () => {
    const result = validateIssueEvidence(
      issueBody({
        evidence:
          'Before: https://example.com/change.png?state=before\nAfter: https://EXAMPLE.com/change.png?state=after#result'
      })
    )

    expect(result.valid).toBe(false)
  })

  it('rejects an HTTP alias for the same GitHub attachment', () => {
    const attachment =
      'github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111'
    const result = validateIssueEvidence(
      issueBody({
        evidence: `Before: http://${attachment}\nAfter: https://${attachment}`
      })
    )

    expect(result.valid).toBe(false)
  })
})

describe('validatePullRequestEvidence', () => {
  it('ignores required headings hidden inside an HTML comment', () => {
    const hidden = `Context 🧪 <!--
## Reproduction or validation steps
1. Hidden valid step
2. Hidden second step

## Evidence type
- [x] Visual
- [ ] Non-visual

## Screencast
https://example.com/hidden.webm
-->`
    const visible = pullRequestBody({
      mode: 'Non-visual',
      rationale: 'N/A: This changes CI metadata only.',
      testEvidence: '`pnpm test:unit` passed.'
    })

    expect(validatePullRequestEvidence(`${hidden}\n${visible}`).valid).toBe(
      true
    )
    expect(validatePullRequestEvidence(hidden).valid).toBe(false)
  })

  it('ignores required headings inside a fenced code sample', () => {
    const fenced = `\`\`\`markdown
## Reproduction or validation steps
1. Hidden valid step
2. Hidden second step

## Evidence type
- [x] Visual
- [ ] Non-visual

## Screencast
https://example.com/hidden.webm
\`\`\``

    expect(validatePullRequestEvidence(fenced).valid).toBe(false)
  })

  it('preserves visible fenced test and log evidence', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        mode: 'Non-visual',
        rationale: 'N/A: This changes CI metadata only.',
        testEvidence: '```text\nStatus: success\n```'
      })
    )

    expect(result.valid).toBe(true)
  })

  it('accepts before and after links', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        after:
          'https://github.com/user-attachments/assets/22222222-2222-4222-8222-222222222222',
        before:
          'https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111'
      })
    )
    expect(result.valid).toBe(true)
  })

  it('accepts one content-verified GitHub screencast', async () => {
    const result = await validatePullRequestEvidenceWithMedia(
      pullRequestBody({
        screencast:
          'https://github.com/user-attachments/assets/77777777-7777-4777-8777-777777777777'
      }),
      vi.fn().mockResolvedValue(true)
    )
    expect(result.valid).toBe(true)
  })

  it('rejects a GitHub screencast when the media probe fails', async () => {
    const result = await validatePullRequestEvidenceWithMedia(
      pullRequestBody({
        screencast:
          'https://github.com/user-attachments/assets/77777777-7777-4777-8777-777777777777'
      }),
      vi.fn().mockRejectedValue(new Error('probe unavailable'))
    )

    expect(result.valid).toBe(false)
  })

  it('rejects an image-markdown attachment in the screencast field', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        screencast:
          '![Screenshot](https://github.com/user-attachments/assets/77777777-7777-4777-8777-777777777777)'
      })
    )

    expect(result.valid).toBe(false)
  })

  it('accepts a non-visual rationale with test evidence', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        mode: 'Non-visual',
        rationale: 'N/A: This only changes CI metadata.',
        testEvidence: '`pnpm test:unit` passed.'
      })
    )
    expect(result.valid).toBe(true)
  })

  it('rejects selecting both evidence modes', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({ mode: 'Both' })
    )
    expect(result.errors).toContain(
      'Check exactly one evidence type: Visual or Non-visual.'
    )
  })

  it('rejects selecting neither evidence mode', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({ mode: 'Neither' })
    )
    expect(result.errors).toContain(
      'Check exactly one evidence type: Visual or Non-visual.'
    )
  })

  it('rejects template placeholders', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        mode: 'Non-visual',
        rationale: 'N/A:',
        steps: '1.',
        testEvidence: 'TBD'
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(3)
  })

  it('rejects single-word validation and log placeholders', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        mode: 'Non-visual',
        rationale: 'N/A: This only changes CI metadata.',
        steps: 'done',
        testEvidence: 'test'
      })
    )
    expect(result.errors).toContain('Add reproduction or validation steps.')
    expect(result.errors).toContain(
      'Non-visual pull requests require test or log evidence.'
    )
  })

  it('rejects a generic all-tests-passed claim without a command or log', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        mode: 'Non-visual',
        rationale: 'N/A: This only changes CI metadata.',
        testEvidence: 'All tests passed.'
      })
    )

    expect(result.errors).toContain(
      'Non-visual pull requests require test or log evidence.'
    )
  })

  it('rejects generic URLs as before and after visual evidence', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        after: 'https://example.com/after',
        before: 'https://example.com/before'
      })
    )
    expect(result.valid).toBe(false)
  })

  it('requires distinct before and after visual evidence', () => {
    const attachment =
      'https://github.com/user-attachments/assets/88888888-8888-4888-8888-888888888888'
    const result = validatePullRequestEvidence(
      pullRequestBody({ after: attachment, before: attachment })
    )
    expect(result.valid).toBe(false)
  })

  it('canonicalizes before and after URLs before comparing them', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        after: 'https://EXAMPLE.com/change.png?state=after#result',
        before: 'https://example.com/change.png?state=before'
      })
    )

    expect(result.valid).toBe(false)
  })

  it('treats a trailing slash as the same visual evidence URL', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({
        after: 'https://www.loom.com/share/same-recording/',
        before: 'https://www.loom.com/share/same-recording'
      })
    )

    expect(result.valid).toBe(false)
  })

  it('rejects an HTTP alias for the same before and after attachment', () => {
    const attachment =
      'github.com/user-attachments/assets/88888888-8888-4888-8888-888888888888'
    const result = validatePullRequestEvidence(
      pullRequestBody({
        after: `https://${attachment}`,
        before: `http://${attachment}`
      })
    )

    expect(result.valid).toBe(false)
  })

  it('rejects an image-only URL in the screencast field', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({ screencast: 'https://example.com/change.png' })
    )

    expect(result.valid).toBe(false)
  })

  it('accepts an explicit video URL in the screencast field', () => {
    const result = validatePullRequestEvidence(
      pullRequestBody({ screencast: 'https://example.com/change.webm' })
    )

    expect(result.valid).toBe(true)
  })
})

describe('probeGitHubScreencast', () => {
  const attachment =
    'https://github.com/user-attachments/assets/77777777-7777-4777-8777-777777777777'

  it('rejects non-GitHub attachment URLs without making a request', async () => {
    const request = vi.fn()

    await expect(
      probeGitHubScreencast('https://example.com/demo.mp4', request)
    ).resolves.toBe(false)
    expect(request).not.toHaveBeenCalled()
  })

  it('follows a manual GitHub redirect and accepts video content', async () => {
    const request = vi.fn().mockResolvedValueOnce(
      mediaResponse(302, {
        location:
          'https://github-production-user-asset-6210df.s3.amazonaws.com/assets/demo.mp4?response-content-type=video%2Fmp4'
      })
    )

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(true)
    expect(request).toHaveBeenNthCalledWith(
      1,
      attachment,
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' })
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('accepts an animated GIF content type', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(mediaResponse(200, { 'content-type': 'image/gif' }))

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(true)
  })

  it('rejects a static screenshot attachment', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(mediaResponse(200, { 'content-type': 'image/png' }))

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(
      false
    )
  })

  it('rejects a GitHub redirect that identifies a static PNG', async () => {
    const request = vi.fn().mockResolvedValueOnce(
      mediaResponse(302, {
        location:
          'https://github-production-user-asset-6210df.s3.amazonaws.com/assets/demo.png?response-content-type=image%2Fpng'
      })
    )

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(
      false
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('uses a range GET when an opaque signed redirect rejects HEAD', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        mediaResponse(302, {
          location:
            'https://github-production-user-asset-6210df.s3.amazonaws.com/assets/demo'
        })
      )
      .mockResolvedValueOnce(mediaResponse(403))
      .mockResolvedValueOnce(
        mediaResponse(206, { 'content-type': 'video/mp4' })
      )

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(true)
    expect(request).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('github-production-user-asset-6210df'),
      expect.objectContaining({ method: 'GET', redirect: 'manual' })
    )
  })

  it.for([405, 501])(
    'uses a range GET when the initial HEAD returns %i',
    async (status) => {
      const request = vi
        .fn()
        .mockResolvedValueOnce(mediaResponse(status))
        .mockResolvedValueOnce(
          mediaResponse(206, { 'content-type': 'video/mp4' })
        )

      await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(
        true
      )
      expect(request).toHaveBeenNthCalledWith(
        2,
        attachment,
        expect.objectContaining({ method: 'GET', redirect: 'manual' })
      )
    }
  )

  it('does not retry an initial 403 response with GET', async () => {
    const request = vi.fn().mockResolvedValue(mediaResponse(403))

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(
      false
    )
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(
      attachment,
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' })
    )
  })

  it('rejects a redirect without a location header', async () => {
    const request = vi.fn().mockResolvedValue(mediaResponse(302))

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(
      false
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.for([
    'http://github-production-user-asset-6210df.s3.amazonaws.com/assets/demo',
    'https://user:password@github-production-user-asset-6210df.s3.amazonaws.com/assets/demo'
  ])('rejects an unsafe redirect target: %s', async (location) => {
    const request = vi.fn().mockResolvedValue(mediaResponse(302, { location }))

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(
      false
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('rejects a redirect chain after five hops', async () => {
    const request = vi.fn().mockResolvedValue(
      mediaResponse(302, {
        location:
          'https://github-production-user-asset-6210df.s3.amazonaws.com/assets/next'
      })
    )

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(
      false
    )
    expect(request).toHaveBeenCalledTimes(5)
  })

  it('rejects redirects outside GitHub media hosts', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        mediaResponse(302, { location: 'https://example.com/video.mp4' })
      )

    await expect(probeGitHubScreencast(attachment, request)).resolves.toBe(
      false
    )
    expect(request).toHaveBeenCalledTimes(1)
  })
})
