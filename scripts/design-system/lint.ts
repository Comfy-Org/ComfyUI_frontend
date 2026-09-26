import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export type DesignLintSeverity = 'error' | 'warning'

export interface DesignLintLine {
  componentTag?: string
  content: string
  filePath: string
  lineNumber: number
}

export interface DesignLintViolation extends DesignLintLine {
  message: string
  ruleId: string
  severity: DesignLintSeverity
}

interface DesignLintRule {
  id: string
  message: string
  severity: DesignLintSeverity
  test: (line: DesignLintLine) => boolean
}

interface LintOptions {
  all: boolean
  base?: string
  files: string[]
  staged: boolean
}

interface WebsiteComponentContract {
  classPolicy: string
  component: string
  implementation: string
}

const ROOT_DIRECTORY = resolve(process.cwd())
const EXCEPTIONS_PATH = resolve(
  ROOT_DIRECTORY,
  'docs/design-system/LINT_EXCEPTIONS.md'
)
const WEBSITE_CONTRACTS_DIRECTORY = resolve(
  ROOT_DIRECTORY,
  'docs/design-system/website/components'
)
const PAGE_CONTRACTS_DIRECTORY = resolve(
  ROOT_DIRECTORY,
  'docs/design-system/pages'
)
const DESIGN_FILE_PATTERN = /\.(?:astro|css|vue)$/

function containsImportantUtility(content: string): boolean {
  const staticClassValue = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(
    content
  )
  const candidates = staticClassValue
    ? [staticClassValue[1] ?? staticClassValue[2] ?? '']
    : /\b(?:cn|cva)\s*\(/.test(content)
      ? (content.match(/"[^"]*"|'[^']*'|`[^`]*`/g) ?? []).map((value) =>
          value.slice(1, -1)
        )
      : []

  return candidates.some((value) => /(?:^|\s)!(?!=)[-\w:[\]/.]+/.test(value))
}

function isWebsiteComposition(filePath: string) {
  return (
    filePath.startsWith('apps/website/src/') &&
    !filePath.startsWith('apps/website/src/components/common/') &&
    !filePath.startsWith('apps/website/src/components/ui/')
  )
}

function isWebsiteFeatureComponent(filePath: string) {
  return (
    filePath.startsWith('apps/website/src/components/') &&
    isWebsiteComposition(filePath)
  )
}

function readPageContracts() {
  if (!existsSync(PAGE_CONTRACTS_DIRECTORY)) return ''
  return readdirSync(PAGE_CONTRACTS_DIRECTORY)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) =>
      readFileSync(resolve(PAGE_CONTRACTS_DIRECTORY, fileName), 'utf8')
    )
    .join('\n')
}

export function parseWebsiteComponentContract(
  markdown: string
): WebsiteComponentContract | undefined {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1]
  if (!frontmatter) return undefined

  const values = new Map(
    frontmatter.split('\n').flatMap((line) => {
      const separator = line.indexOf(':')
      if (separator < 1) return []
      return [
        [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
      ]
    })
  )
  const component = values.get('component')
  const implementation = values.get('implementation')
  const classPolicy = values.get('class_policy')
  if (!component || !implementation || !classPolicy) return undefined

  return { classPolicy, component, implementation }
}

function readWebsiteComponentContracts() {
  const contracts = new Map<string, WebsiteComponentContract>()
  if (!existsSync(WEBSITE_CONTRACTS_DIRECTORY)) return contracts

  for (const fileName of readdirSync(WEBSITE_CONTRACTS_DIRECTORY)) {
    if (!fileName.endsWith('.md')) continue
    const contract = parseWebsiteComponentContract(
      readFileSync(resolve(WEBSITE_CONTRACTS_DIRECTORY, fileName), 'utf8')
    )
    if (contract) contracts.set(contract.component, contract)
  }

  return contracts
}

const websiteComponentContracts = readWebsiteComponentContracts()
const pageContracts = readPageContracts()

const rules: DesignLintRule[] = [
  {
    id: 'DS001',
    severity: 'error',
    message:
      'Use semantic theme tokens instead of a dark: or dark-theme: variant.',
    test: ({ content }) => /\bdark(?:-theme)?:/.test(content)
  },
  {
    id: 'DS002',
    severity: 'error',
    message:
      'Do not use Tailwind !important utilities; fix the conflicting style.',
    test: ({ content }) => containsImportantUtility(content)
  },
  {
    id: 'DS003',
    severity: 'error',
    message:
      'Use a Tailwind fraction or a named dimension token instead of an arbitrary percentage.',
    test: ({ content }) =>
      /\b(?:h|max-h|max-w|min-h|min-w|w)-\[\d+(?:\.\d+)?%\]/.test(content)
  },
  {
    id: 'DS004',
    severity: 'error',
    message: 'Use cn() instead of an array-valued :class binding.',
    test: ({ content }) => /:class\s*=\s*["']\s*\[/.test(content)
  },
  {
    id: 'DS005',
    severity: 'error',
    message:
      'Size Iconify icons with size-* utilities, not text-size utilities.',
    test: ({ content }) =>
      /icon(?:-mask)?-\[/.test(content) &&
      /\btext-(?:\d+xl|base|lg|sm|xl|xs)\b/.test(content)
  },
  {
    id: 'DS006',
    severity: 'error',
    message:
      'Use an existing semantic color token; add a token at the appropriate theme boundary when no semantic role exists.',
    test: ({ content, filePath }) =>
      !filePath.startsWith('packages/design-system/src/css/') &&
      filePath !== 'apps/website/src/styles/global.css' &&
      /(?:class|style|background|border|color|fill|stroke)/i.test(content) &&
      /#[\da-f]{3,8}\b|\b(?:hsl|hsla|rgb|rgba)\(/i.test(content)
  },
  {
    id: 'DS007',
    severity: 'error',
    message:
      'Do not introduce a direct PrimeVue dependency; use or extend src/components/ui.',
    test: ({ content, filePath }) =>
      filePath.startsWith('src/') && /from\s+['"]primevue\//.test(content)
  },
  {
    id: 'DS008',
    severity: 'warning',
    message:
      'Prefer the matching src/components/ui primitive over a raw interactive element.',
    test: ({ content, filePath }) =>
      filePath.startsWith('src/') &&
      !filePath.startsWith('src/components/ui/') &&
      /<(?:button|input|select|textarea)(?:\s|>)/.test(content)
  },
  {
    id: 'DS009',
    severity: 'error',
    message:
      'Website compositions must use an approved component instead of a raw interactive element.',
    test: ({ content, filePath }) =>
      isWebsiteComposition(filePath) &&
      /<(?:button|input|select|textarea)(?:\s|>)/.test(content)
  },
  {
    id: 'DS010',
    severity: 'error',
    message:
      'Do not use a literal action arrow; use an approved icon-bearing component.',
    test: ({ content, filePath }) =>
      isWebsiteComposition(filePath) && /[→↗]/.test(content)
  },
  {
    id: 'DS011',
    severity: 'error',
    message:
      'Interactive states belong to approved website components, not page compositions.',
    test: ({ content, filePath }) =>
      isWebsiteComposition(filePath) &&
      /(?:^|[\s"'])(?:hover|focus|focus-visible|focus-within|active|disabled|data-\[state)[^\s"']*:/.test(
        content
      )
  },
  {
    id: 'DS012',
    severity: 'error',
    message:
      'Do not visually override a governed website component; use its approved props or a wrapper.',
    test: ({ componentTag, content, filePath }) => {
      if (!componentTag) return false
      const contract = websiteComponentContracts.get(componentTag)
      return (
        contract?.classPolicy === 'none' &&
        filePath !== contract.implementation &&
        /(?:^|\s)(?::class|class(?::list)?)\s*=/.test(content)
      )
    }
  },
  {
    id: 'DS013',
    severity: 'error',
    message:
      'Document each new website composition in a page contract before implementing it.',
    test: ({ filePath, lineNumber }) =>
      lineNumber === 1 &&
      isWebsiteFeatureComponent(filePath) &&
      !pageContracts.includes(`\`${basename(filePath)}\``)
  }
]

export function lintDesignLines(
  lines: DesignLintLine[],
  exceptions = new Set<string>()
): DesignLintViolation[] {
  return lines.flatMap((line) =>
    rules
      .filter(
        (rule) =>
          !isExcepted(exceptions, line.filePath, rule.id) && rule.test(line)
      )
      .map((rule) => ({
        ...line,
        message: rule.message,
        ruleId: rule.id,
        severity: rule.severity
      }))
  )
}

export function parseAddedLines(diff: string): DesignLintLine[] {
  const addedLines: DesignLintLine[] = []
  let activeComponentTag = ''
  let filePath = ''
  let newLineNumber = 0

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      filePath = normalizeDiffPath(line.slice(4))
      activeComponentTag = ''
      continue
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk) {
      newLineNumber = Number(hunk[1])
      activeComponentTag = ''
      continue
    }

    if (!filePath || line.startsWith('\\ No newline')) continue

    const content =
      line.startsWith('+') || line.startsWith(' ') ? line.slice(1) : line
    if (!line.startsWith('-')) {
      const openedComponent = /<([A-Z][\w.]*)\b/.exec(content)?.[1]
      if (openedComponent) activeComponentTag = openedComponent
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedLine: DesignLintLine = {
        content,
        filePath,
        lineNumber: newLineNumber
      }
      if (activeComponentTag) addedLine.componentTag = activeComponentTag
      addedLines.push(addedLine)
      newLineNumber += 1
    } else if (!line.startsWith('-')) {
      newLineNumber += 1
    }

    if (!line.startsWith('-') && activeComponentTag && />/.test(content))
      activeComponentTag = ''
  }

  return addedLines.filter(({ filePath }) => DESIGN_FILE_PATTERN.test(filePath))
}

export function parseLintExceptions(markdown: string): Set<string> {
  const exceptions = new Set<string>()

  for (const line of markdown.split('\n')) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
    if (cells.length < 2 || !/^DS\d{3}$/.test(cells[1])) continue
    exceptions.add(`${cells[0]}:${cells[1]}`)
  }

  return exceptions
}

function isExcepted(exceptions: Set<string>, filePath: string, ruleId: string) {
  return [...exceptions].some((exception) => {
    const separator = exception.lastIndexOf(':')
    const pathPattern = exception.slice(0, separator)
    const exceptionRule = exception.slice(separator + 1)
    if (exceptionRule !== ruleId) return false
    return pathPattern.endsWith('/**')
      ? filePath.startsWith(pathPattern.slice(0, -3))
      : filePath === pathPattern
  })
}

function normalizeDiffPath(diffPath: string) {
  if (diffPath === '/dev/null') return ''
  return diffPath.startsWith('b/') ? diffPath.slice(2) : diffPath
}

function parseOptions(args: string[]): LintOptions {
  const options: LintOptions = { all: false, files: [], staged: false }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--all') {
      options.all = true
    } else if (argument === '--staged') {
      options.staged = true
    } else if (argument === '--base') {
      options.base = args[index + 1]
      index += 1
    } else {
      options.files.push(argument)
    }
  }

  return options
}

function runGit(args: string[]) {
  return execFileSync('git', args, {
    cwd: ROOT_DIRECTORY,
    encoding: 'utf8'
  })
}

function resolveBase(base: string) {
  for (const candidate of [base, `origin/${base}`]) {
    try {
      runGit(['rev-parse', '--verify', candidate])
      return candidate
    } catch {
      continue
    }
  }
  throw new Error(`Could not resolve base revision ${base}`)
}

function readWholeFiles(filePaths: string[]): DesignLintLine[] {
  return filePaths.flatMap((filePath) => {
    const absolutePath = resolve(ROOT_DIRECTORY, filePath)
    if (!DESIGN_FILE_PATTERN.test(filePath) || !existsSync(absolutePath))
      return []
    let activeComponentTag = ''
    return readFileSync(absolutePath, 'utf8')
      .split('\n')
      .map((content, index) => {
        const openedComponent = /<([A-Z][\w.]*)\b/.exec(content)?.[1]
        if (openedComponent) activeComponentTag = openedComponent
        const line: DesignLintLine = {
          content,
          filePath,
          lineNumber: index + 1
        }
        if (activeComponentTag) line.componentTag = activeComponentTag
        if (activeComponentTag && />/.test(content)) activeComponentTag = ''
        return line
      })
  })
}

function getLinesToLint(options: LintOptions) {
  if (options.files.length > 0) {
    return readWholeFiles(
      options.files.map((filePath) =>
        relative(ROOT_DIRECTORY, resolve(filePath))
      )
    )
  }

  if (options.all) {
    const files = runGit(['ls-files', '--', '*.astro', '*.vue', '*.css'])
      .trim()
      .split('\n')
      .filter(Boolean)
    return readWholeFiles(files)
  }

  const diffArguments = [
    'diff',
    '--no-ext-diff',
    '--unified=0',
    '--diff-filter=ACMR'
  ]
  if (options.staged) diffArguments.push('--cached')
  if (options.base) diffArguments.push(`${resolveBase(options.base)}...HEAD`)
  diffArguments.push('--', '*.astro', '*.vue', '*.css')

  const lines = parseAddedLines(runGit(diffArguments))
  if (options.staged || options.base) return lines

  const untrackedFiles = runGit([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    '*.astro',
    '*.vue',
    '*.css'
  ])
    .trim()
    .split('\n')
    .filter(Boolean)
  return [...lines, ...readWholeFiles(untrackedFiles)]
}

function run() {
  const options = parseOptions(process.argv.slice(2))
  const exceptions = existsSync(EXCEPTIONS_PATH)
    ? parseLintExceptions(readFileSync(EXCEPTIONS_PATH, 'utf8'))
    : new Set<string>()
  const violations = lintDesignLines(getLinesToLint(options), exceptions)

  for (const violation of violations) {
    console.error(
      `${violation.filePath}:${violation.lineNumber} ${violation.severity} ${violation.ruleId} ${violation.message}`
    )
  }

  const errors = violations.filter(({ severity }) => severity === 'error')
  if (violations.length > 0) {
    console.error(
      `Design-system lint found ${errors.length} error(s) and ${violations.length - errors.length} warning(s).`
    )
  }
  if (errors.length > 0) process.exitCode = 1
}

const entryPath = process.argv[1]
if (entryPath && pathToFileURL(resolve(entryPath)).href === import.meta.url)
  run()
