/**
 * The `src/data/*.ts` source adapter.
 *
 * 464 `LocalizedText` literals across 17 files — event listings, launch pages,
 * tutorials, affiliate copy. Chinese is complete; Japanese has two.
 *
 * Read through the TypeScript AST rather than by importing the modules. Two
 * reasons: several of them import `../config/routes` and build values at
 * runtime, so importing would execute code and yield strings that are not in
 * the file; and the writer needs to put `ja:` back into a specific object
 * literal, which needs positions a runtime value cannot give.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  ScriptTarget,
  createSourceFile,
  isArrayLiteralExpression,
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
  isVariableStatement
} from 'typescript'
import type {
  Node,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  PropertyAssignment
} from 'typescript'

import { DEFAULT_LOCALE, isLocale } from '../../../config/locales'
import type { Locale } from '../../../config/locales'
import type { SourceAdapter, SourceEntry } from '../types'

const DATA_DIR = join(process.cwd(), 'src', 'data')

/**
 * Fields that are `LocalizedText` because the type permits a per-locale value,
 * not because anyone wrote one. Every `href` pair in the repo is byte-identical
 * across locales; handing a URL to a translator can only damage it.
 */
const NEVER_PROSE: ReadonlySet<string> = new Set([
  'href',
  'src',
  'poster',
  'url',
  'image'
])

function literalText(node: Node): string | undefined {
  return isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined
}

function propertyName(property: ObjectLiteralElementLike): string | undefined {
  if (!isPropertyAssignment(property)) return undefined
  const { name } = property
  if (isIdentifier(name) || isStringLiteral(name)) return name.text
  return undefined
}

function findProperty(
  node: ObjectLiteralExpression,
  wanted: string
): PropertyAssignment | undefined {
  for (const property of node.properties) {
    if (propertyName(property) === wanted && isPropertyAssignment(property)) {
      return property
    }
  }
  return undefined
}

/** The name an object calls itself, when it has one. */
function ownIdentifier(node: ObjectLiteralExpression): string | undefined {
  for (const field of ['id', 'slug']) {
    const property = findProperty(node, field)
    const value = property && literalText(property.initializer)
    if (value) return value
  }
  return undefined
}

/** One `LocalizedText` literal, with the node so a writer can edit it. */
interface LocalizedLiteral {
  key: string
  english: string
  node: ObjectLiteralExpression
}

/**
 * Visit every `LocalizedText` literal in one data file.
 *
 * The key is `<file>.<declaration>.<enclosing ids>.<field>`. Both the file and
 * the declaration are needed: `drops.ts` declares several bare
 * `const X: LocalizedText` with no enclosing object, and rooting at the file
 * alone collapsed seven of them onto one key. An array index appears only for
 * an element with no `id` or `slug`, so reordering a list of identified records
 * renumbers nothing — and a key that churns is a key the manifest pays to
 * translate again.
 *
 * The reader and the writer both go through here. If each walked the file its
 * own way, a divergence would write Japanese onto the wrong key and no test
 * would see it.
 */
function forEachLocalizedText(
  fileName: string,
  sourceText: string,
  visit: (literal: LocalizedLiteral) => void
): void {
  const source = createSourceFile(
    fileName,
    sourceText,
    ScriptTarget.Latest,
    true
  )
  const fileKey = fileName.replace(/\.ts$/, '')

  const walk = (node: Node, path: string[], scope: string): void => {
    if (isObjectLiteralExpression(node)) {
      const english = findProperty(node, DEFAULT_LOCALE)
      const englishText = english && literalText(english.initializer)

      if (englishText !== undefined) {
        // `.at()` rather than an index, so the empty case is in the type and
        // the guard below is not dead code to a type-aware reader.
        const field = path.at(-1)
        if (field !== undefined && NEVER_PROSE.has(field)) return
        visit({
          key: [scope, ...path].filter(Boolean).join('.'),
          english: englishText,
          node
        })
        return
      }

      const ownId = ownIdentifier(node)
      const nextScope = ownId ? `${scope}.${ownId}` : scope
      for (const property of node.properties) {
        const name = propertyName(property)
        if (!name || !isPropertyAssignment(property)) continue
        walk(property.initializer, ownId ? [name] : [...path, name], nextScope)
      }
      return
    }

    if (isArrayLiteralExpression(node)) {
      node.elements.forEach((element, index) => {
        const identified =
          isObjectLiteralExpression(element) &&
          ownIdentifier(element) !== undefined
        walk(element, identified ? [] : [...path, String(index)], scope)
      })
      return
    }

    node.forEachChild((child) => {
      walk(child, path, scope)
    })
  }

  for (const statement of source.statements) {
    if (!isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer || !isIdentifier(declaration.name)) {
        continue
      }
      // `affiliateBenefits.ts` exports `affiliateBenefits`, and repeating the
      // name helped nobody read the key. Collapsed when the two match; both
      // are kept when they differ, which is what keeps `drops.ts` unique.
      const declared = declaration.name.text
      const scope = declared === fileKey ? fileKey : `${fileKey}.${declared}`
      walk(declaration.initializer, [], scope)
    }
  }
}

/** Pure, so it can be tested without a fixture directory. */
export function entriesFromSource(
  fileName: string,
  sourceText: string
): SourceEntry[] {
  const entries: SourceEntry[] = []

  forEachLocalizedText(fileName, sourceText, ({ key, english, node }) => {
    const approved: Partial<Record<Locale, string>> = {}
    for (const property of node.properties) {
      const name = propertyName(property)
      if (!name || name === DEFAULT_LOCALE || !isLocale(name)) continue
      if (!isPropertyAssignment(property)) continue
      // The pipeline's own output is not an approved translation. Reporting it
      // as one would exclude the key from every later run and freeze it.
      if (isMachineWritten(sourceText, property)) continue
      const value = literalText(property.initializer)
      if (value !== undefined) approved[name] = value
    }
    entries.push({ key, english, approved })
  })

  return entries
}

/**
 * Replace `length` bytes at `offset` with `text`. A length of zero is a pure
 * insertion, which is what all but a re-translation is.
 */
export interface Edit {
  offset: number
  length: number
  text: string
}

/**
 * Rebuild the file from slices of the original with new text between them.
 *
 * This is the safety argument for the writer. The only bytes that can go
 * missing are the ones an edit explicitly names, and `planJapanese` only ever
 * names a string literal the pipeline itself wrote. Everything else is carried
 * across untouched by construction rather than by a test that has to keep
 * proving it.
 */
export function applyEdits(sourceText: string, edits: readonly Edit[]): string {
  const ordered = [...edits].sort((a, b) => a.offset - b.offset)

  let result = ''
  let taken = 0
  for (const edit of ordered) {
    result += sourceText.slice(taken, edit.offset) + edit.text
    taken = edit.offset + edit.length
  }
  return result + sourceText.slice(taken)
}

/**
 * A TypeScript string literal, safe for any input.
 *
 * Quote choice follows oxfmt: whichever delimiter needs fewer escapes, single
 * on a tie. Matching the formatter means `pnpm format` is a no-op on what the
 * writer produced, so the diff a reviewer reads is the diff we made rather than
 * the writer's output plus a reformatting pass over it.
 */
function quote(value: string): string {
  const occurrences = (mark: string) => value.split(mark).length - 1
  const delimiter = occurrences("'") > occurrences('"') ? '"' : "'"

  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll(delimiter, `\\${delimiter}`)
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')

  return `${delimiter}${escaped}${delimiter}`
}

/** The indentation of the line the offset sits on. */
function indentAt(sourceText: string, offset: number): string {
  const lineStart = sourceText.lastIndexOf('\n', offset - 1) + 1
  return /^[ \t]*/.exec(sourceText.slice(lineStart, offset))?.[0] ?? ''
}

/**
 * What the writer stamps on a value it produced.
 *
 * A block comment rather than `//` because an inserted value can land inside a
 * single-line object, where a line comment would swallow the closing brace.
 */
const MACHINE_MARKER = ' /* machine */'

/**
 * Did the pipeline write this value, or did a person?
 *
 * The distinction decides whether the value is *approved*, and approved values
 * are never re-sent to the model. Machine output that read back as approved
 * could therefore never be refreshed: the English would change, `staleKeys`
 * would prune the machine layer, and the data file would keep serving the
 * translation of a sentence that no longer exists.
 *
 * Both comment styles are accepted so the marker can also be written by hand.
 */
function isMachineWritten(
  sourceText: string,
  property: PropertyAssignment
): boolean {
  const following = sourceText.slice(property.end, property.end + 48)
  return /^\s*,?\s*(?:\/\*\s*machine\s*\*\/|\/\/\s*machine\b)/.test(following)
}

/**
 * Where a `ja:` goes in one data file, and what it should say.
 *
 * Nothing is written here. A plan can be inspected, counted and refused before
 * a byte moves, which is what makes a dry run possible.
 *
 * Three cases, and the marker is what tells them apart:
 *
 * - no `ja` yet — insert one, marked as machine output
 * - a marked `ja` whose text has moved on — replace just the literal
 * - anything else — leave it alone, because a person wrote it
 */
export function planJapanese(
  fileName: string,
  sourceText: string,
  japanese: Readonly<Partial<Record<string, string>>>
): Edit[] {
  const edits: Edit[] = []

  forEachLocalizedText(fileName, sourceText, ({ key, node }) => {
    const value = japanese[key]
    if (value === undefined) return

    const existing = findProperty(node, 'ja')
    if (existing) {
      if (!isMachineWritten(sourceText, existing)) return
      if (literalText(existing.initializer) === value) return

      const from = existing.initializer.getStart()
      edits.push({
        offset: from,
        length: existing.initializer.end - from,
        text: quote(value)
      })
      return
    }

    const last = node.properties.at(-1)
    if (!last) return

    // Match the shape of the literal being edited. Breaking a single-line
    // object across lines makes oxfmt expand the whole thing, turning a
    // one-line insertion into a five-line diff.
    const spansLines = sourceText
      .slice(node.getStart(), node.end)
      .includes('\n')

    const written = `ja: ${quote(value)}${MACHINE_MARKER}`
    edits.push({
      offset: last.end,
      length: 0,
      text: spansLines
        ? `,\n${indentAt(sourceText, last.getStart())}${written}`
        : `, ${written}`
    })
  })

  return edits
}

export const dataAdapter: SourceAdapter = {
  name: 'data',

  read(): SourceEntry[] {
    return readdirSync(DATA_DIR)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .sort()
      .flatMap((file) =>
        entriesFromSource(file, readFileSync(join(DATA_DIR, file), 'utf8'))
      )
  }
}

/**
 * Everything that must still be true after a write, checked against the plan
 * that produced it.
 *
 * Returns problems rather than throwing, so a caller can gather them across
 * every file and refuse the whole run before touching any of it. The value is
 * in what it rejects: a byte changed outside the planned edits, a translation
 * disturbed, an entry lost, or Japanese written without its marker — which
 * would read back as approved and never be refreshed again.
 */
export function verifyWrite(
  fileName: string,
  original: string,
  written: string,
  edits: readonly Edit[]
): string[] {
  const problems: string[] = []

  const delta = edits.reduce((n, edit) => n + edit.text.length - edit.length, 0)
  if (written.length !== original.length + delta) {
    problems.push('length does not match the plan')
  }

  // An edit's offset is a position in the ORIGINAL; in the written text it has
  // been pushed along by every edit before it. Undo them in reverse — putting
  // replaced bytes back from the original — and the original must return byte
  // for byte.
  let shift = 0
  const placed = [...edits]
    .sort((a, b) => a.offset - b.offset)
    .map((edit) => {
      const at = edit.offset + shift
      shift += edit.text.length - edit.length
      return { at, edit }
    })

  let rebuilt = written
  for (const { at, edit } of [...placed].reverse()) {
    rebuilt =
      rebuilt.slice(0, at) +
      original.slice(edit.offset, edit.offset + edit.length) +
      rebuilt.slice(at + edit.text.length)
  }
  if (rebuilt !== original) {
    problems.push('undoing the edits does not restore the original')
  }

  const before = entriesFromSource(fileName, original)
  const after = entriesFromSource(fileName, written)

  if (before.length !== after.length) {
    problems.push(`entries went from ${before.length} to ${after.length}`)
    return problems
  }

  for (const [index, entry] of before.entries()) {
    const now = after[index]
    if (now.key !== entry.key) problems.push(`key moved: ${entry.key}`)
    if (now.english !== entry.english) {
      problems.push(`English changed: ${entry.key}`)
    }
    if (now.approved['zh-CN'] !== entry.approved['zh-CN']) {
      problems.push(`Chinese changed: ${entry.key}`)
    }
    if (now.approved.ja !== undefined) {
      problems.push(`Japanese reads back as approved: ${entry.key}`)
    }
  }

  return problems
}
