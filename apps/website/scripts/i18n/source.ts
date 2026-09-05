import { readFileSync } from 'node:fs'

import type {
  Expression,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile
} from 'typescript'
import {
  createSourceFile,
  isAsExpression,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isStringLiteralLike,
  isVariableStatement,
  ScriptTarget
} from 'typescript'

export interface TranslationEntry {
  key: string
  values: Record<string, string>
  insertPoint: number
  replaceRanges: Record<string, { start: number; end: number }>
}

export interface ParsedTranslations {
  text: string
  entries: TranslationEntry[]
}

export interface TextEdit {
  start: number
  end: number
  replacement: string
}

function describeLocation(node: Node, sourceFile: SourceFile): string {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
  return `${sourceFile.fileName}:${line + 1}`
}

function propertyKeyText(
  property: PropertyAssignment,
  sourceFile: SourceFile
): string {
  const { name } = property
  if (isIdentifier(name) || isStringLiteralLike(name)) return name.text
  throw new Error(
    `Unsupported translation key syntax at ${describeLocation(name, sourceFile)}`
  )
}

function unwrapToObjectLiteral(
  expression: Expression
): ObjectLiteralExpression | undefined {
  if (isObjectLiteralExpression(expression)) return expression
  if (isAsExpression(expression) || isSatisfiesExpression(expression)) {
    return unwrapToObjectLiteral(expression.expression)
  }
  return undefined
}

function findTranslationsObjectLiteral(
  sourceFile: SourceFile
): ObjectLiteralExpression {
  for (const statement of sourceFile.statements) {
    if (!isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (
        isIdentifier(declaration.name) &&
        declaration.name.text === 'translations' &&
        declaration.initializer
      ) {
        const literal = unwrapToObjectLiteral(declaration.initializer)
        if (literal) return literal
      }
    }
  }
  throw new Error(
    `${sourceFile.fileName}: could not find a \`const translations = {...}\` declaration`
  )
}

export function parseTranslations(sourcePath: string): ParsedTranslations {
  return parseTranslationsText(readFileSync(sourcePath, 'utf8'), sourcePath)
}

export function parseTranslationsText(
  text: string,
  fileName: string
): ParsedTranslations {
  const sourceFile = createSourceFile(fileName, text, ScriptTarget.Latest, true)
  const translationsObject = findTranslationsObjectLiteral(sourceFile)

  const entries = translationsObject.properties.map((property) => {
    if (!isPropertyAssignment(property)) {
      throw new Error(
        `Unsupported translations entry at ${describeLocation(property, sourceFile)}`
      )
    }
    const key = propertyKeyText(property, sourceFile)
    const localeObject = property.initializer
    if (!isObjectLiteralExpression(localeObject)) {
      throw new Error(`translations["${key}"] is not an object literal`)
    }

    const values: Record<string, string> = {}
    const replaceRanges: TranslationEntry['replaceRanges'] = {}
    // The last property's end, not the object literal's own end (which is
    // past the closing brace) — otherwise an inserted locale would land as a
    // sibling of the entry instead of inside it.
    let insertPoint = -1

    for (const localeProperty of localeObject.properties) {
      if (!isPropertyAssignment(localeProperty)) {
        throw new Error(
          `translations["${key}"] has an unsupported entry at ${describeLocation(localeProperty, sourceFile)}`
        )
      }
      const locale = propertyKeyText(localeProperty, sourceFile)
      const valueNode = localeProperty.initializer
      if (!isStringLiteralLike(valueNode)) {
        throw new Error(`translations["${key}"].${locale} is not a string`)
      }
      values[locale] = valueNode.text
      replaceRanges[locale] = {
        start: valueNode.getStart(sourceFile),
        end: valueNode.getEnd()
      }
      insertPoint = Math.max(insertPoint, localeProperty.getEnd())
    }

    return { key, values, insertPoint, replaceRanges }
  })

  return { text, entries }
}

function formatPropertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

export function insertLocaleEdit(
  entry: TranslationEntry,
  locale: string,
  value: string
): TextEdit {
  return {
    start: entry.insertPoint,
    end: entry.insertPoint,
    replacement: `,\n    ${formatPropertyKey(locale)}: ${JSON.stringify(value)}`
  }
}

export function replaceLocaleEdit(
  entry: TranslationEntry,
  locale: string,
  value: string
): TextEdit {
  const range = entry.replaceRanges[locale]
  if (!range) {
    throw new Error(`translations["${entry.key}"].${locale} does not exist`)
  }
  return {
    start: range.start,
    end: range.end,
    replacement: JSON.stringify(value)
  }
}

export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, edit) =>
        result.slice(0, edit.start) + edit.replacement + result.slice(edit.end),
      text
    )
}
