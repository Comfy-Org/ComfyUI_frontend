import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { posix } from 'node:path'

import { isMainModule } from './isMainModule'

export type RepoIndex = {
  paths: ReadonlySet<string>
  topLevelDirectories: ReadonlySet<string>
  commands: ReadonlySet<string>
}

type Finding = {
  line: number
  message: string
  targets: string[]
}

const PNPM_BUILTINS = [
  'add',
  'approve-builds',
  'audit',
  'bin',
  'cache',
  'catalog',
  'config',
  'create',
  'dedupe',
  'deploy',
  'dlx',
  'doctor',
  'env',
  'exec',
  'fetch',
  'help',
  'i',
  'import',
  'info',
  'init',
  'install',
  'licenses',
  'link',
  'list',
  'ls',
  'outdated',
  'pack',
  'patch',
  'patch-commit',
  'prune',
  'publish',
  'rebuild',
  'remove',
  'rm',
  'root',
  'run',
  'self-update',
  'setup',
  'start',
  'store',
  'test',
  'un',
  'uninstall',
  'unlink',
  'up',
  'update',
  'version',
  'view',
  'why'
]
const PNPM_OPTIONS_WITH_VALUE = new Set([
  '--filter',
  '-F',
  '-C',
  '--dir',
  '--workspace-dir',
  '--reporter'
])
const MODULE_EXTENSIONS = ['.ts', '.vue', '.mts', '.js', '.tsx', '/index.ts']
const PLACEHOLDER_SEGMENT =
  /^(?:[Mm]y|[Yy]our|[Ss]ome)[A-Z_-]|^(?:[Ee]xample|[Ff]oo|[Bb]ar|[Xx]{2,})(?:\.|$)/
const PLACEHOLDER_CHARACTERS = /[<>*{}$[\]…]|\.\.\./
const URL_SCHEME = /^[a-z][a-z\d+.-]*:|^\/\//i
const INLINE_CODE = /(`+)(.+?)\1/g
const LINK_TARGET = /\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*)?\)/g
const LINK_DEFINITION = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/
const FENCE = /^\s{0,3}(`{3,}|~{3,})/

function isPlaceholder(reference: string): boolean {
  if (PLACEHOLDER_CHARACTERS.test(reference)) return true
  const segments = reference.split('/')
  return segments.some(
    (segment, index) =>
      PLACEHOLDER_SEGMENT.test(segment) ||
      (segment === 'path' && segments[index + 1] === 'to')
  )
}

function exists(paths: ReadonlySet<string>, path: string): boolean {
  return [path, ...MODULE_EXTENSIONS.map((extension) => path + extension)].some(
    (candidate) => paths.has(candidate)
  )
}

function ancestors(directory: string): string[] {
  const parent = posix.dirname(directory)
  return directory === '.' ? ['.'] : [directory, ...ancestors(parent)]
}

function stripLocation(reference: string): string {
  return reference
    .replace(/#.*$/, '')
    .replace(/:\d[\d,:-]*$/, '')
    .replace(/\/+$/, '')
}

function checkLinkTarget(
  rawTarget: string,
  documentDirectory: string,
  index: RepoIndex
): Finding['targets'] | undefined {
  if (URL_SCHEME.test(rawTarget) || rawTarget.startsWith('#')) return
  const target = stripLocation(safeDecode(rawTarget.replace(/\?.*$/, '')))
  if (!target || isPlaceholder(target)) return
  const resolved = target.startsWith('/')
    ? posix.normalize(target.slice(1))
    : posix.join(documentDirectory, target)
  return exists(index.paths, resolved) ? undefined : [resolved]
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function checkCodePath(
  token: string,
  documentDirectory: string,
  index: RepoIndex
): Finding['targets'] | undefined {
  const reference = stripLocation(
    token.replace(/^["'(]+/, '').replace(/[.,:;)"']+$/, '')
  ).replace(/^@\//, 'src/')
  const [first] = reference.split('/')
  if (!reference.includes('/') || !index.topLevelDirectories.has(first)) return
  if (isPlaceholder(reference)) return
  const candidates = ancestors(documentDirectory).map((base) =>
    posix.join(base, reference)
  )
  return candidates.some((candidate) => exists(index.paths, candidate))
    ? undefined
    : [posix.normalize(reference)]
}

function findUndefinedPnpmCommands(code: string, index: RepoIndex): string[] {
  return [...code.matchAll(/(?:^|[\s;&|(])pnpm\s+([^;&|\n]*)/g)].flatMap(
    ([, argumentText]) => {
      const command = pnpmCommand(argumentText.trim().split(/\s+/))
      if (!command || PLACEHOLDER_CHARACTERS.test(command)) return []
      return index.commands.has(command) ? [] : [command]
    }
  )
}

function pnpmCommand(tokens: string[]): string | undefined {
  if (!tokens.length) return
  const [token, ...rest] = tokens
  if (PNPM_OPTIONS_WITH_VALUE.has(token)) return pnpmCommand(rest.slice(1))
  if (token.startsWith('-') || token === 'run') return pnpmCommand(rest)
  return token.replace(/[`'".,:)]+$/, '')
}

type LineIssue = Omit<Finding, 'line'>

function classifyLines(contents: string): { text: string; fenced: boolean }[] {
  let fence: string | undefined
  return contents.split('\n').map((text) => {
    const marker = FENCE.exec(text)?.[1]
    if (fence === undefined) {
      fence = marker
      return { text: marker ? '' : text, fenced: false }
    }
    if (
      text.trim() === marker &&
      marker[0] === fence[0] &&
      marker.length >= fence.length
    ) {
      fence = undefined
      return { text: '', fenced: true }
    }
    return { text, fenced: true }
  })
}

function commandIssues(code: string, index: RepoIndex): LineIssue[] {
  return findUndefinedPnpmCommands(code, index).map((command) => ({
    message: `pnpm command "${command}" is not defined`,
    targets: []
  }))
}

function proseIssues(
  line: string,
  documentDirectory: string,
  index: RepoIndex
): LineIssue[] {
  const codeIssues = [...line.matchAll(INLINE_CODE)].flatMap(([, , code]) => [
    ...commandIssues(code, index),
    ...code.split(/\s+/).flatMap((token) => {
      const targets = checkCodePath(token, documentDirectory, index)
      return targets
        ? [{ message: `path "${token}" does not exist`, targets }]
        : []
    })
  ])
  const prose = line.replace(INLINE_CODE, ' ')
  const linkIssues = [
    ...[...prose.matchAll(LINK_TARGET)].map(([, target]) => target),
    ...(LINK_DEFINITION.exec(prose)?.slice(1, 2) ?? [])
  ].flatMap((target) => {
    const targets = checkLinkTarget(target, documentDirectory, index)
    return targets
      ? [{ message: `link "${target}" does not resolve`, targets }]
      : []
  })
  return [...codeIssues, ...linkIssues]
}

/** Reports repo paths and pnpm commands in one markdown document that do not resolve. */
export function findBrokenReferences(
  markdownPath: string,
  contents: string,
  index: RepoIndex
): Finding[] {
  const documentDirectory = posix.dirname(markdownPath)
  return classifyLines(contents).flatMap(({ text, fenced }, lineIndex) =>
    (fenced
      ? commandIssues(text, index)
      : proseIssues(text, documentDirectory, index)
    ).map((issue) => ({ line: lineIndex + 1, ...issue }))
  )
}

function git(args: string[]): string {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  })
}

function withAncestors(files: string[]): Set<string> {
  return new Set(
    files.flatMap((file) => [file, ...ancestors(posix.dirname(file))])
  )
}

function buildIndex(files: string[]): RepoIndex {
  const packageScripts = files
    .filter((file) => posix.basename(file) === 'package.json')
    .flatMap((file) =>
      Object.keys(JSON.parse(readFileSync(file, 'utf8')).scripts ?? {})
    )
  const binaries = existsSync('node_modules/.bin')
    ? readdirSync('node_modules/.bin')
    : []
  return {
    paths: withAncestors(files),
    topLevelDirectories: new Set(
      files
        .filter((file) => file.includes('/'))
        .map((file) => file.split('/')[0])
    ),
    commands: new Set([...PNPM_BUILTINS, ...packageScripts, ...binaries])
  }
}

function removedPaths(base: string, current: ReadonlySet<string>): Set<string> {
  const mergeBase = git(['merge-base', base, 'HEAD']).trim()
  const removedFiles = git([
    'diff',
    '--name-status',
    '--diff-filter=DR',
    '-z',
    mergeBase,
    'HEAD'
  ])
    .split('\0')
    .filter((_, position, entries) => /^[DR]/.test(entries[position - 1] ?? ''))
  return new Set(
    [...withAncestors(removedFiles)].filter((path) => !current.has(path))
  )
}

function changedMarkdown(base: string): Set<string> {
  const mergeBase = git(['merge-base', base, 'HEAD']).trim()
  return new Set(
    git(['diff', '--name-only', '--diff-filter=ACMR', '-z', mergeBase, 'HEAD'])
      .split('\0')
      .filter((file) => /\.mdx?$/.test(file))
  )
}

function main(argv: string[]): number {
  const baseIndex = argv.indexOf('--base')
  const base = baseIndex === -1 ? undefined : argv[baseIndex + 1]
  const files = git([
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z'
  ])
    .split('\0')
    .filter((file) => file && existsSync(file))
  const index = buildIndex(files)
  const markdownFiles = files.filter(
    (file) => /\.mdx?$/.test(file) && !lstatSync(file).isSymbolicLink()
  )
  const changed = base ? changedMarkdown(base) : undefined
  const removed = base ? removedPaths(base, index.paths) : new Set<string>()
  const isReported = (file: string, finding: Finding) =>
    !changed ||
    changed.has(file) ||
    finding.targets.some((target) => exists(removed, target))

  const failures = markdownFiles.flatMap((file) =>
    findBrokenReferences(file, readFileSync(file, 'utf8'), index)
      .filter((finding) => isReported(file, finding))
      .map((finding) => ({ file, ...finding }))
  )
  for (const { file, line, message } of failures) {
    console.error(
      process.env.GITHUB_ACTIONS
        ? `::error file=${file},line=${line}::${message}`
        : `${file}:${line}: ${message}`
    )
  }
  if (failures.length) {
    console.error(
      `\n${failures.length} broken markdown reference(s). Point each at the current file or script, delete the stale text, or drop the backticks when it names a file that does not exist yet.`
    )
    return 1
  }
  console.log(
    `Markdown references resolve in ${changed ? `${changed.size} changed file(s)` : `${markdownFiles.length} file(s)`}`
  )
  return 0
}

if (isMainModule(import.meta.url)) {
  process.chdir(git(['rev-parse', '--show-toplevel']).trim())
  process.exitCode = main(process.argv.slice(2))
}
