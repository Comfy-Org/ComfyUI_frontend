import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { normalizeI18nKey } from '@comfyorg/shared-frontend-utils/formatUtil'

/**
 * Every command declared in source must keep an English entry in
 * src/locales/en/commands.json, because SelectionToolbox-style call sites read
 * `commands.<normalized id>.label` and @intlify/vue-i18n/no-missing-keys only
 * fails once such a call site exists.
 *
 * scripts/collect-i18n-general.ts rewrites that catalog from the commands the
 * running app has registered, so a command whose extension had not loaded at
 * collection time is pruned. Nothing fails at that moment: ESLint caches on
 * file content and config, never on catalog content, so the prune can reach a
 * release branch and only surface later as a lint error in an unrelated PR.
 * `Comfy.3DViewer.Open3DViewer` was pruned that way three times — restored by
 * #22130, dropped again by the 1.59.3 bump, and fixed at the source for the
 * lazy 3D extension by #22168 (FE-3637).
 *
 * This guard is the mechanical check that was missing: it reads declared
 * command ids out of the source tree, so it needs neither a browser nor a
 * regeneration run and catches the pruned state on any branch.
 */
export const COMMAND_SOURCE_GLOB = 'src/**/*.ts'

export const COMMANDS_CATALOG_FILE = 'src/locales/en/commands.json'

export interface DeclaredCommand {
  id: string
  file: string
  line: number
}

/** A declaration whose id is computed, so this guard cannot resolve it. */
export interface UnresolvedCommand {
  file: string
  line: number
}

export interface CommandLocaleGap extends DeclaredCommand {
  key: string
  reason: 'missing-entry' | 'missing-label'
}

export interface CommandCatalog {
  [key: string]: { label?: unknown } | unknown
}

const isGeneratedOrTestFile = (file: string): boolean =>
  /\.(test|spec)\.ts$/.test(file) ||
  file.endsWith('.d.ts') ||
  file.startsWith('src/locales/') ||
  file.includes('__tests__/') ||
  file.includes('__mocks__/') ||
  file.includes('__fixtures__/')

export function findCommandSourceFiles(repositoryRoot: string): string[] {
  return globSync(COMMAND_SOURCE_GLOB, { cwd: repositoryRoot })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => !isGeneratedOrTestFile(file))
    .sort()
}

/** Unwraps `[...] as const` and `[...] satisfies T` around a command array. */
function arrayLiteral(
  expression: ts.Expression | undefined
): ts.ArrayLiteralExpression | undefined {
  if (!expression) return
  if (ts.isArrayLiteralExpression(expression)) return expression
  if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))
    return arrayLiteral(expression.expression)
  if (ts.isParenthesizedExpression(expression))
    return arrayLiteral(expression.expression)
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
}

/** The `commands: [...]` of a ComfyExtension, or `const commands = [...]`. */
function commandArray(node: ts.Node): ts.ArrayLiteralExpression | undefined {
  if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'commands')
    return arrayLiteral(node.initializer)
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === 'commands'
  )
    return arrayLiteral(node.initializer)
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  )
}

export function collectDeclaredCommands(
  file: string,
  source: string
): { declared: DeclaredCommand[]; unresolved: UnresolvedCommand[] } {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const declared: DeclaredCommand[] = []
  const unresolved: UnresolvedCommand[] = []
  const walk = (node: ts.Node): void => {
    const array = commandArray(node)
    for (const element of array?.elements ?? []) {
      if (!ts.isObjectLiteralExpression(element)) continue
      for (const property of element.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          propertyName(property.name) !== 'id'
        )
          continue
        const line = lineOf(sourceFile, property)
        if (ts.isStringLiteralLike(property.initializer))
          declared.push({ id: property.initializer.text, file, line })
        else unresolved.push({ file, line })
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(sourceFile)
  return { declared, unresolved }
}

export function findCommandLocaleGaps(
  declared: readonly DeclaredCommand[],
  catalog: CommandCatalog
): CommandLocaleGap[] {
  const gaps = new Map<string, CommandLocaleGap>()
  for (const command of declared) {
    const key = normalizeI18nKey(command.id)
    if (gaps.has(key)) continue
    const entry: unknown = Object.hasOwn(catalog, key)
      ? catalog[key]
      : undefined
    if (entry === undefined || entry === null) {
      gaps.set(key, { ...command, key, reason: 'missing-entry' })
      continue
    }
    const label: unknown =
      typeof entry === 'object' && Object.hasOwn(entry, 'label')
        ? Reflect.get(entry, 'label')
        : undefined
    if (typeof label !== 'string' || label.trim().length === 0)
      gaps.set(key, { ...command, key, reason: 'missing-label' })
  }
  return [...gaps.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function readCommandCatalog(repositoryRoot: string): CommandCatalog {
  const file = resolve(repositoryRoot, COMMANDS_CATALOG_FILE)
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error(`${COMMANDS_CATALOG_FILE} is not a JSON object`)
  return parsed as CommandCatalog
}

export function checkCommandLocales(repositoryRoot: string): {
  files: string[]
  declared: DeclaredCommand[]
  unresolved: UnresolvedCommand[]
  gaps: CommandLocaleGap[]
} {
  const files = findCommandSourceFiles(repositoryRoot)
  const declared: DeclaredCommand[] = []
  const unresolved: UnresolvedCommand[] = []
  for (const file of files) {
    const found = collectDeclaredCommands(
      file,
      readFileSync(resolve(repositoryRoot, file), 'utf8')
    )
    declared.push(...found.declared)
    unresolved.push(...found.unresolved)
  }
  return {
    files,
    declared,
    unresolved,
    gaps: findCommandLocaleGaps(declared, readCommandCatalog(repositoryRoot))
  }
}

export function formatGap(gap: CommandLocaleGap): string {
  const detail =
    gap.reason === 'missing-entry'
      ? `has no commands.${gap.key} entry`
      : `has no commands.${gap.key}.label string`
  return `${gap.file}:${gap.line} command '${gap.id}' ${detail}`
}

function main(): void {
  const { files, declared, unresolved, gaps } = checkCommandLocales(
    process.cwd()
  )
  if (gaps.length === 0) {
    const skipped = unresolved.length
      ? `; ${unresolved.length} computed id(s) not resolvable statically`
      : ''
    process.stdout.write(
      `Command locale guard passed (${declared.length} declared commands across ${files.length} files${skipped})\n`
    )
    return
  }
  process.stderr.write(
    `Command locale guard found ${gaps.length} declared command(s) missing from ${COMMANDS_CATALOG_FILE}:\n\n` +
      gaps.map(formatGap).join('\n') +
      `\n\nLocale regeneration prunes a command whose extension had not registered when ` +
      `scripts/collect-i18n-general.ts ran, and ESLint's cache can hide the result until an ` +
      `unrelated pull request fails. Restore the entry, and fix collection so the command is ` +
      `declared to the collector as #22168 did for the lazy 3D extension.\n`
  )
  process.exitCode = 1
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main()
}
