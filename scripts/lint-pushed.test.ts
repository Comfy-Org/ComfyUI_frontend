import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { filesToLint, pushedRanges } from './lint-pushed'

const nullSha = '0'.repeat(40)

describe('pushedRanges', () => {
  it.for([
    ['nothing', '', []],
    [
      'an update of a branch the remote already has',
      `refs/heads/feature abc123 refs/heads/feature def456\n`,
      [{ localSha: 'abc123', remoteSha: 'def456' }]
    ],
    [
      'a new branch, which has no remote sha to diff against',
      `refs/heads/feature abc123 refs/heads/feature ${nullSha}\n`,
      [{ localSha: 'abc123', remoteSha: undefined }]
    ],
    [
      'a branch deletion, which pushes no commits',
      `(delete) ${nullSha} refs/heads/feature def456\n`,
      []
    ],
    [
      'several refs in one push',
      [
        `refs/heads/a 111 refs/heads/a 222`,
        `refs/heads/b 333 refs/heads/b ${nullSha}`
      ].join('\n'),
      [
        { localSha: '111', remoteSha: '222' },
        { localSha: '333', remoteSha: undefined }
      ]
    ]
  ] as const)('reads %s', ([, input, expected]) => {
    expect(pushedRanges(input)).toEqual(expected)
  })
})

function createRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'lint-pushed-'))
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }))
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t',
        '-c',
        'commit.gpgsign=false',
        ...args
      ],
      { cwd: dir, encoding: 'utf8' }
    ).trim()
  const commit = (message: string, files: Record<string, string | null>) => {
    for (const [name, content] of Object.entries(files)) {
      if (content === null) git('rm', '-q', name)
      else {
        writeFileSync(join(dir, name), content)
        git('add', name)
      }
    }
    git('commit', '-q', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  git('init', '-q')
  return { dir, git, commit }
}

function pushLine(localSha: string, remoteSha = nullSha) {
  return `refs/heads/x ${localSha} refs/heads/x ${remoteSha}\n`
}

describe('filesToLint', () => {
  function repoWithHistory() {
    const repo = createRepo()
    const base = repo.commit('base', {
      'a.ts': 'a',
      'deleted.ts': 'gone',
      'README.md': 'docs'
    })
    repo.git('branch', 'other')
    repo.git('checkout', '-q', 'other')
    const other = repo.commit('other', { 'c.ts': 'c' })
    repo.git('checkout', '-q', '-')
    const head = repo.commit('head', {
      'a.ts': 'a2',
      'b.ts': 'b',
      'missing.ts': 'never on disk',
      'deleted.ts': null,
      'README.md': 'docs2'
    })
    rmSync(join(repo.dir, 'missing.ts'))
    repo.git('update-ref', 'refs/remotes/origin/main', base)
    return { ...repo, base, other, head }
  }

  type Shas = { base: string; other: string; head: string }

  it.for([
    [
      'lints lintable files the pushed commits add or modify on the working tree, against the remote sha',
      ({ head, base }: Shas) => pushLine(head, base),
      ['a.ts', 'b.ts'],
      () => []
    ],
    [
      'diffs a new branch against origin/main',
      ({ head }: Shas) => pushLine(head),
      ['a.ts', 'b.ts'],
      () => []
    ],
    [
      'leaves a commit other than HEAD to CI, because ESLint reads the working tree',
      ({ other, base }: Shas) => pushLine(other, base),
      [],
      ({ other }: Shas) => [
        `lint-pushed: not the checked-out commit for ${other}; CI lint will cover it\n`
      ]
    ]
  ] as const)('%s', ([, input, expectedFiles, expectedStderr]) => {
    const repo = repoWithHistory()
    const stderr = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    const files = filesToLint(input(repo), repo.dir)

    expect(files).toEqual(expectedFiles)
    expect(stderr.mock.calls.map(([message]) => String(message))).toEqual(
      expectedStderr(repo)
    )
  })

  it('leaves a commit with no reachable base to CI', () => {
    const repo = createRepo()
    const head = repo.commit('orphan', { 'a.ts': 'a' })
    const stderr = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    expect(filesToLint(pushLine(head), repo.dir)).toEqual([])
    expect(stderr).toHaveBeenCalledWith(
      `lint-pushed: no base found for ${head}; CI lint will cover it\n`
    )
  })
})
