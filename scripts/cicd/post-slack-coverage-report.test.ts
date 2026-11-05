import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SCRIPT = join(import.meta.dirname, 'post-slack-coverage-report.sh')
const PAYLOAD = '{"text":"Coverage improved!","blocks":[]}'

function slackFixture() {
  const root = mkdtempSync(join(tmpdir(), 'slack-coverage-'))
  const bin = join(root, 'bin')
  const request = join(root, 'request')
  mkdirSync(bin)

  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$CURL_ARGS"
if [[ -n "\${CURL_FAILS:-}" ]]; then
  echo 'curl: (6) Could not resolve host: slack.com' >&2
  exit 6
fi
printf '%s' "$SLACK_RESPONSE"
`,
    { mode: 0o755 }
  )

  return {
    request,
    run(options: { response?: string; channel?: string; reachable?: boolean }) {
      const { response = '{"ok":true}', channel, reachable = true } = options
      const result = spawnSync('bash', [SCRIPT], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          CURL_ARGS: request,
          ...(reachable ? {} : { CURL_FAILS: '1' }),
          SLACK_RESPONSE: response,
          SLACK_PAYLOAD: PAYLOAD,
          SLACK_BOT_TOKEN: 'xoxb-test',
          ...(channel === undefined ? {} : { SLACK_CHANNEL_ID: channel })
        }
      })
      return {
        status: result.status,
        output: `${result.stdout}${result.stderr}`
      }
    },
    postedBody(): unknown {
      const args = readFileSync(request, 'utf8').split('\n')
      return JSON.parse(args[args.indexOf('-d') + 1] ?? 'null')
    },
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

describe('post-slack-coverage-report.sh', () => {
  it('posts the payload to the configured channel', () => {
    using fixture = slackFixture()

    const result = fixture.run({ channel: 'C0NEWCHANNEL' })

    expect(result.status).toBe(0)
    expect(result.output).not.toContain('::error::')
    expect(fixture.postedBody()).toEqual({
      text: 'Coverage improved!',
      blocks: [],
      channel: 'C0NEWCHANNEL'
    })
  })

  // A repository variable cannot be set from a PR, so an unset one has to keep
  // reports flowing to the old channel rather than fail the run.
  it('falls back to the deprecated channel and says so', () => {
    using fixture = slackFixture()

    const result = fixture.run({})

    expect(result.status).toBe(0)
    expect(fixture.postedBody()).toMatchObject({ channel: 'C0AP09LKRDZ' })
    expect(result.output).toContain(
      '::warning::Repository variable COVERAGE_SLACK_CHANNEL_ID is unset'
    )
  })

  // Every row is an HTTP 200 that did not deliver anything. Reading the status
  // code alone would call each of them a success and let the caller advance the
  // E2E baseline past a report nobody saw.
  it.for<[response: string, reported: string]>([
    ['{"ok":false,"error":"channel_not_found"}', 'channel_not_found'],
    ['{"ok":false,"error":"not_in_channel"}', 'not_in_channel'],
    ['{"ok":false,"error":"invalid_auth"}', 'invalid_auth'],
    ['<html>502 Bad Gateway</html>', '<html>502 Bad Gateway</html>'],
    ['', 'empty response']
  ])('fails on a 200 that answers %s', ([response, reported]) => {
    using fixture = slackFixture()

    const result = fixture.run({ response, channel: 'C0NEWCHANNEL' })

    expect(result.status).toBe(1)
    expect(result.output).toContain(
      `::error::Slack rejected the coverage report: ${reported}`
    )
  })

  it('fails when Slack cannot be reached at all', () => {
    using fixture = slackFixture()

    const result = fixture.run({ reachable: false, channel: 'C0NEWCHANNEL' })

    expect(result.status).toBe(1)
    expect(result.output).toContain(
      '::error::Could not reach Slack to post the coverage report.'
    )
  })
})
