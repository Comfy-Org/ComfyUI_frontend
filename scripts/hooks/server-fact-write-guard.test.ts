import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

import {
  disableDirectiveFindings,
  proposedContent
} from './server-fact-write-guard'

const SCRIPT = path.join(import.meta.dirname, 'server-fact-write-guard.ts')
const PANEL = 'src/platform/workspace/composables/usePanel.ts'
const BROKEN_CONFIG = path.join(import.meta.dirname, 'missing.oxlintrc.json')

const panelSource = [
  'const { canInviteMembers } = useBillingCapabilities()',
  'const canInvite = computed(() => canInviteMembers.value)',
  ''
].join('\n')

const panelWithFinding = [
  'const { canInviteMembers } = useBillingCapabilities()',
  '// invite gate',
  'const canInvite = computed(() => canInviteMembers.value || isOwner.value)',
  ''
].join('\n')

function repoWith(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'write-guard-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(path.join(root, '.git'))
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), text)
  }
  return root
}

function runGuard(
  root: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  env: Record<string, string> = {}
) {
  const event = {
    tool_name: toolName,
    cwd: root,
    tool_input: {
      ...toolInput,
      file_path: path.join(root, String(toolInput.file_path))
    }
  }
  return spawnSync(process.execPath, ['--import', 'tsx', SCRIPT], {
    cwd: path.resolve(import.meta.dirname, '../..'),
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...process.env, ...env }
  })
}

describe('proposedContent', () => {
  it.for<
    [
      string,
      string,
      Record<string, unknown>,
      string | undefined,
      string | undefined
    ]
  >([
    ['Write replaces the file', 'Write', { content: 'b' }, 'a', 'b'],
    ['Write creates a file', 'Write', { content: 'b' }, undefined, 'b'],
    [
      'Edit replaces the single match',
      'Edit',
      { old_string: 'x', new_string: '$&y' },
      'a x b',
      'a $&y b'
    ],
    [
      'Edit with replace_all replaces every match',
      'Edit',
      { old_string: 'x', new_string: 'y', replace_all: true },
      'x x',
      'y y'
    ],
    [
      'Edit refuses an ambiguous match',
      'Edit',
      { old_string: 'x', new_string: 'y' },
      'x x',
      undefined
    ],
    [
      'Edit refuses a missing match',
      'Edit',
      { old_string: 'z', new_string: 'y' },
      'x',
      undefined
    ],
    [
      'Edit with an empty old_string creates a file',
      'Edit',
      { old_string: '', new_string: 'new' },
      undefined,
      'new'
    ],
    [
      'MultiEdit applies edits in order',
      'MultiEdit',
      {
        edits: [
          { old_string: 'a', new_string: 'b' },
          { old_string: 'b c', new_string: 'd' }
        ]
      },
      'a c',
      'd'
    ],
    [
      'MultiEdit refuses when any edit misses',
      'MultiEdit',
      {
        edits: [
          { old_string: 'a', new_string: 'b' },
          { old_string: 'a', new_string: 'c' }
        ]
      },
      'a',
      undefined
    ]
  ])('%s', ([, toolName, input, before, expected]) => {
    expect(proposedContent(toolName, input, before)).toBe(expected)
  })
})

describe('disableDirectiveFindings', () => {
  it.for<[string, string, number[]]>([
    [
      'a next-line disable naming a server-fact rule',
      '// oxlint-disable-next-line comfy/no-capability-recombination',
      [1]
    ],
    [
      'an eslint block disable naming a server-fact rule',
      '/* eslint-disable comfy/no-server-fact-literals */',
      [1]
    ],
    [
      'a bare disable that turns off every rule',
      '// eslint-disable-next-line',
      [1]
    ],
    [
      'a disable for an unrelated rule',
      '// oxlint-disable-next-line no-console -- logging',
      []
    ],
    ['ordinary code', 'const a = 1', []]
  ])('reports %s', ([, line, expected]) => {
    const findings = disableDirectiveFindings(PANEL, `${line}\n`, [
      { kind: 'added', start: 1, end: 1 }
    ])

    expect(findings.map(({ line }) => line)).toEqual(expected)
  })

  it('ignores a directive on a line the change did not add', () => {
    const text =
      '// oxlint-disable-next-line comfy/no-server-fact-literals\nx\n'

    expect(
      disableDirectiveFindings(PANEL, text, [
        { kind: 'added', start: 2, end: 2 }
      ])
    ).toEqual([])
  })
})

describe('server-fact-write-guard hook', () => {
  it('blocks an edit that recombines a capability and names the line', () => {
    const root = repoWith({ [PANEL]: panelSource })

    const result = runGuard(root, 'Edit', {
      file_path: PANEL,
      old_string: 'canInviteMembers.value)',
      new_string: 'canInviteMembers.value || isPlanEnded.value)'
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain(
      `server-fact: ${PANEL}:2 A server capability is combined with other state through \`||\`.`
    )
    expect(result.stderr).toContain("pendingServerFact('BE-xxxx', ...)")
  })

  it('blocks a newly added inline disable of a server-fact rule', () => {
    const root = repoWith({ [PANEL]: panelSource })

    const result = runGuard(root, 'Edit', {
      file_path: PANEL,
      old_string: 'const canInvite',
      new_string:
        '// oxlint-disable-next-line comfy/no-capability-recombination\nconst canInvite'
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`server-fact: ${PANEL}:2 An inline disable`)
  })

  it('allows a comment-only edit to a file that already has findings', () => {
    const root = repoWith({ [PANEL]: panelWithFinding })

    const result = runGuard(root, 'Edit', {
      file_path: PANEL,
      old_string: '// invite gate',
      new_string: '// invite gate for the members panel'
    })

    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: ''
    })
  })

  it.for([
    ['a test file', 'src/platform/workspace/composables/usePanel.test.ts'],
    ['a path outside src', 'browser_tests/fixtures/panel.ts']
  ])('allows %s without linting it', ([, file]) => {
    const root = repoWith({ [file]: panelSource })

    const result = runGuard(
      root,
      'Edit',
      {
        file_path: file,
        old_string: 'canInviteMembers.value)',
        new_string: 'canInviteMembers.value || isPlanEnded.value)'
      },
      { SERVER_FACT_OXLINT_CONFIG: BROKEN_CONFIG }
    )

    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: ''
    })
  })

  it('allows an edit the tool cannot apply without linting it', () => {
    const root = repoWith({ [PANEL]: panelSource })

    const result = runGuard(
      root,
      'Edit',
      { file_path: PANEL, old_string: 'not in file', new_string: 'x || y' },
      { SERVER_FACT_OXLINT_CONFIG: BROKEN_CONFIG }
    )

    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: ''
    })
  })

  it('fails open with a warning when oxlint cannot run', () => {
    const root = repoWith({ [PANEL]: panelSource })

    const result = runGuard(
      root,
      'Edit',
      {
        file_path: PANEL,
        old_string: 'canInviteMembers.value)',
        new_string: 'canInviteMembers.value || isPlanEnded.value)'
      },
      { SERVER_FACT_OXLINT_CONFIG: BROKEN_CONFIG }
    )

    expect(result.status).toBe(0)
    expect(result.stderr).toMatch(
      /^server-fact hook skipped: oxlint did not produce a report/
    )
  })
})
