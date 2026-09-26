// @vitest-environment node
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'

import { zAgentThreadListResponse } from '@comfyorg/ingest-types/zod'
import { globSync } from 'glob'
import { describe, expect, it } from 'vitest'

import { emptyAgentThreadPage } from '@e2e/fixtures/utils/agentThreadPage'

const browserTestsDir = new URL('../..', import.meta.url).pathname

// Matches a `/api/agent/threads` mock answered with an object literal written
// at the call site, which is where the drift happened: ten of them said
// `{ threads: [] }` and none of them said `pagination`.
const inlineThreadsBody = /jsonRoute\(\s*\{\s*threads:/

function specFiles(): string[] {
  return globSync('**/*.ts', { cwd: browserTestsDir, absolute: true })
}

describe('emptyAgentThreadPage', () => {
  it('satisfies the contract the panel parses the response against', () => {
    // `listThreads()` parses with this schema and lets the failure out, so a
    // body the schema rejects reaches the user as "Comfy Agent hit a server
    // error." over the canvas.
    expect(() =>
      zAgentThreadListResponse.parse(emptyAgentThreadPage())
    ).not.toThrow()
  })

  it('rejects the shape the mocks had drifted to', () => {
    expect(() => zAgentThreadListResponse.parse({ threads: [] })).toThrow()
  })

  it('is the only way browser_tests builds an empty thread page', () => {
    const offenders = specFiles()
      .filter((path) => inlineThreadsBody.test(readFileSync(path, 'utf8')))
      .map((path) => relative(browserTestsDir, path))
      .sort()
    expect(offenders).toEqual([])
  })
})
