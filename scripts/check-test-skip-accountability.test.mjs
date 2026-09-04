import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const directory = fileURLToPath(new URL('.', import.meta.url))
const script = `${directory}check-test-skip-accountability.mjs`
const fixture = (name) =>
  `${directory}fixtures/test-skip-accountability/${name}`

const runChecker = (body, diff = 'added-fixme.diff') =>
  spawnSync(
    process.execPath,
    [script, '--diff-file', fixture(diff), '--body-file', fixture(body)],
    { encoding: 'utf8' }
  )

describe('test skip accountability checker', () => {
  it('rejects an added fixme without restoration tracking', () => {
    const result = runChecker('unlinked-body.md')

    assert.equal(result.status, 1)
    assert.match(result.stderr, /tracking issue or follow-up PR/)
  })

  it('accepts an added fixme with a linked tracking issue', () => {
    const result = runChecker('linked-body.md')

    assert.equal(result.status, 0, result.stderr)
  })

  it('ignores skip-like text in comments and strings', () => {
    const result = runChecker('unlinked-body.md', 'non-executable-skips.diff')

    assert.equal(result.status, 0, result.stderr)
  })
})
