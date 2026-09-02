import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const SRC_DIR = join(process.cwd(), 'src')
const LOCALES = ['en', 'zh-CN', 'ja'] as const
const DEFAULT_LOCALE = 'en'

type Locale = (typeof LOCALES)[number]

interface Violation {
  file: string
  line: number
  message: string
}

interface ComponentUsage {
  name: string
  target: string
  line: number
  attributes: string
}

const LOCALE_PROP_DECLARATION = /\blocale\??\s*:\s*Locale\b/
const IMPORT_STATEMENT =
  /import\s+(\w+)\s+from\s+['"]([^'"]+\.(?:vue|astro))['"]/g
/**
 * `locale="en"`, `:locale="locale"`, Vue's same-name shorthand `:locale`, and
 * Astro's shorthand `{locale}` all count as passing the prop.
 */
const LOCALE_ATTRIBUTE =
  /(?:^|\s)(?:(?::|v-bind:)locale(?![\w-])|locale\s*=)|\{\s*locale\s*\}/
const SPREAD_ATTRIBUTE = /\{\s*\.\.\.|v-bind\s*=/
const LOCALE_LITERAL = /(?:^|\s)locale\s*=\s*(?:'([^']*)'|"([^"]*)")/

function sourceFiles(): string[] {
  return readdirSync(SRC_DIR, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith('.vue') || entry.endsWith('.astro'))
    .map((entry) => join(SRC_DIR, entry))
}

/**
 * The region of a file that renders markup. Imports live outside it, and
 * scanning only this region keeps TypeScript generics (`Foo<Bar>`) from
 * registering as component usages.
 */
function templateOf(
  source: string,
  file: string
): { text: string; offset: number } {
  if (file.endsWith('.astro')) {
    const fence = /^---\r?\n[\s\S]*?\r?\n---/.exec(source)
    const offset = fence ? fence[0].length : 0
    return { text: source.slice(offset), offset }
  }

  const open = source.indexOf('<template')
  const close = source.lastIndexOf('</template>')
  if (open === -1 || close === -1) return { text: '', offset: 0 }
  return { text: source.slice(open, close), offset: open }
}

function declaresLocaleProp(source: string, file: string): boolean {
  if (file.endsWith('.astro')) {
    const fence = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)
    return fence ? LOCALE_PROP_DECLARATION.test(fence[1]) : false
  }
  const { offset } = templateOf(source, file)
  const scripts = offset > 0 ? source.slice(0, offset) : source
  return LOCALE_PROP_DECLARATION.test(scripts)
}

function importedComponents(source: string, file: string): Map<string, string> {
  const imports = new Map<string, string>()
  for (const [, name, specifier] of source.matchAll(IMPORT_STATEMENT)) {
    imports.set(name, resolve(dirname(file), specifier))
  }
  return imports
}

/**
 * Attributes of the opening tag starting at `start`. Quote and brace tracking
 * keeps `>` inside an expression (`count={a > b}`) from ending the tag early.
 */
function openingTagAttributes(text: string, start: number): string {
  let quote: string | null = null
  let depth = 0

  for (let index = start; index < text.length; index++) {
    const char = text[index]

    if (quote) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth++
    else if (char === '}') depth--
    else if (char === '>' && depth === 0) {
      return text.slice(start, text[index - 1] === '/' ? index - 1 : index)
    }
  }
  return text.slice(start)
}

function componentUsages(
  source: string,
  file: string,
  imports: Map<string, string>
): ComponentUsage[] {
  const { text, offset } = templateOf(source, file)
  const usages: ComponentUsage[] = []

  for (const match of text.matchAll(/<([A-Z]\w*)/g)) {
    const target = imports.get(match[1])
    if (!target || match.index === undefined) continue

    const attributesStart = match.index + match[0].length
    usages.push({
      name: match[1],
      target,
      line: lineOf(source, offset + match.index),
      attributes: openingTagAttributes(text, attributesStart)
    })
  }
  return usages
}

function lineOf(source: string, index: number): number {
  let line = 1
  for (let cursor = 0; cursor < index; cursor++) {
    if (source[cursor] === '\n') line++
  }
  return line
}

/**
 * The locale a page renders in, derived from its path: localized directories
 * use their matching locale, while everything else under `pages/` uses the
 * unprefixed default locale.
 * Shared components live outside `pages/` and inherit their caller's locale,
 * so they have no fixed locale and return `undefined`.
 */
function pageLocale(file: string): Locale | undefined {
  const segments = relative(SRC_DIR, file).split(sep)
  if (segments[0] !== 'pages') return undefined

  const prefixed = LOCALES.find(
    (locale) => locale !== DEFAULT_LOCALE && segments[1] === locale
  )
  return prefixed ?? DEFAULT_LOCALE
}

function main(): void {
  const sources = sourceFiles().map((file) => ({
    file,
    source: readFileSync(file, 'utf8')
  }))

  const localeAware = new Set(
    sources
      .filter(({ file, source }) => declaresLocaleProp(source, file))
      .map(({ file }) => file)
  )

  const violations: Violation[] = []

  for (const { file, source } of sources) {
    const expected = pageLocale(file)
    const usages = componentUsages(
      source,
      file,
      importedComponents(source, file)
    )

    for (const usage of usages) {
      if (!localeAware.has(usage.target)) continue

      const { attributes } = usage
      if (!LOCALE_ATTRIBUTE.test(attributes)) {
        // A spread may carry `locale`, but then it is invisible to this check
        // and to a reader. Require it to be named.
        const via = SPREAD_ATTRIBUTE.test(attributes)
          ? 'receives `locale` only via a spread, which hides it from review'
          : 'receives no `locale` prop'
        violations.push({
          file,
          line: usage.line,
          message: `<${usage.name}> renders localized text but ${via}`
        })
        continue
      }

      const literal = LOCALE_LITERAL.exec(attributes)
      const passed = literal?.[1] ?? literal?.[2]
      if (passed && expected && passed !== expected) {
        violations.push({
          file,
          line: usage.line,
          message: `<${usage.name}> is passed locale="${passed}" on a ${expected} page`
        })
      }
    }
  }

  if (localeAware.size === 0) {
    console.error(
      'Locale prop validation found no locale-aware components, which means\ndetection is broken rather than the tree being clean. Failing loudly.'
    )
    process.exit(1)
  }

  if (violations.length > 0) {
    console.error(
      `Locale prop validation failed (${violations.length} violation${violations.length === 1 ? '' : 's'}):\n`
    )
    for (const violation of violations) {
      console.error(
        `  ${relative(process.cwd(), violation.file)}:${violation.line}\n    ${violation.message}`
      )
    }
    console.error(
      '\nEvery component that renders translated text needs the active locale.\nPass it explicitly: <Section locale="zh-CN" /> or :locale="locale".'
    )
    process.exit(1)
  }

  process.stdout.write(
    `Locale props valid: ${localeAware.size} locale-aware components, ${sources.length} files scanned.\n`
  )
}

main()
