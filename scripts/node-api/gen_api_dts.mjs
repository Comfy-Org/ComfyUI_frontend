import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import ts from 'typescript'
import { format } from 'oxfmt'
import formatConfig from '../../.oxfmtrc.json' with { type: 'json' }

import { reachableDeclarationNames } from './gen_api_surface.mjs'

function sourceDirectory() {
  return fileURLToPath(new URL('../../src/platform/nodeApi/', import.meta.url))
}

function tupleElementUnion(type, tuples) {
  if (
    !ts.isIndexedAccessTypeNode(type) ||
    type.indexType.kind !== ts.SyntaxKind.NumberKeyword
  )
    return undefined
  const object = ts.isParenthesizedTypeNode(type.objectType)
    ? type.objectType.type
    : type.objectType
  if (!ts.isTypeQueryNode(object) || !ts.isIdentifier(object.exprName)) {
    return undefined
  }
  return tuples.get(object.exprName.text)
}

/** Exported interfaces and type aliases, with their doc comments. */
export function declarations(source) {
  const sourceFile = ts.createSourceFile(
    'nodeApi.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const tuples = new Map()
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      const value = declaration.initializer
      if (
        !ts.isIdentifier(declaration.name) ||
        !value ||
        !ts.isAsExpression(value) ||
        value.type.getText(sourceFile) !== 'const' ||
        !ts.isArrayLiteralExpression(value.expression) ||
        !value.expression.elements.length ||
        !value.expression.elements.every(ts.isStringLiteral)
      )
        continue
      tuples.set(
        declaration.name.text,
        value.expression.elements
          .map((item) => item.getText(sourceFile))
          .join(' | ')
      )
    }
  }

  return sourceFile.statements.flatMap((statement) => {
    const kind = ts.isInterfaceDeclaration(statement)
      ? 'interface'
      : ts.isTypeAliasDeclaration(statement)
        ? 'type'
        : undefined
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
    if (!kind || !exported) return []
    let text = statement.getFullText(sourceFile)
    const union = ts.isTypeAliasDeclaration(statement)
      ? tupleElementUnion(statement.type, tuples)
      : undefined
    if (union) {
      const start =
        statement.type.getStart(sourceFile) - statement.getFullStart()
      const end = statement.type.end - statement.getFullStart()
      text = text.slice(0, start) + union + text.slice(end)
    }

    return [
      {
        name: statement.name.text,
        kind,
        text: text.trim()
      }
    ]
  })
}

export async function buildApiDts(directory = sourceDirectory()) {
  const files = readdirSync(directory)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort()

  const published = reachableDeclarationNames(directory)
  const sections = []
  for (const file of files) {
    const found = declarations(
      readFileSync(join(directory, file), 'utf8')
    ).filter((d) => published.has(d.name))
    if (!found.length) continue
    sections.push(found.map((d) => d.text).join('\n\n'))
  }

  const source =
    `/** Generated from src/platform/nodeApi; import from '/comfy/api/v2.js'. */\n` +
    `declare module '*/comfy/api/v2.js' {\n` +
    sections
      .join('\n\n')
      .split('\n')
      .map((line) => (line ? `  ${line}` : ''))
      .join('\n') +
    `\n\n` +
    `  export const comfy: Comfy\n` +
    `}\n`
  const result = await format('comfy-api.d.ts', source, formatConfig)
  if (result.errors.length) {
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  }
  return result.code
}

const entryPath = process.argv[1]
if (
  entryPath &&
  realpathSync(fileURLToPath(import.meta.url)) ===
    realpathSync(resolve(entryPath))
) {
  process.stdout.write(await buildApiDts())
}
