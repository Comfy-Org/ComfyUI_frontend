import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const readme = readFileSync(
  resolve(root, 'scripts/registry-census/README.md'),
  'utf8'
)
const workflow = readFileSync(
  resolve(root, '.github/workflows/ci-ecosystem-matrix.yaml'),
  'utf8'
)
const shouldRun = workflow.match(
  /outputs:\n\s+should-run: >-\n(?<body>.*?)\n\s+steps:/s
)?.groups?.body

describe('ecosystem matrix trigger contract', () => {
  test('limits pull-request execution to release candidates', () => {
    expect(shouldRun).toContain("github.event_name == 'pull_request'")
    expect(shouldRun).toContain("startsWith(github.head_ref, 'version-bump-')")
    expect(shouldRun).toContain("github.head_ref == 'chore/corpus-pins'")
    expect(shouldRun).not.toContain("github.event_name == 'merge_group'")
  })

  test('documents ordinary pull requests as not applicable', () => {
    expect(readme).toMatch(
      /The expensive matrix runs only on same-repository\s+`version-bump-\*` and\s+`chore\/corpus-pins` pull requests/
    )
  })
})
