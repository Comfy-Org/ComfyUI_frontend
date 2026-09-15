/**
 * Regenerates `src/platform/nodeApi/apiSurface.ts` from the published API.
 *
 *   node scripts/node-api/gen_api_surface.mjs
 *
 * The generated set is what the conformance harness checks converted code
 * against, so it has to track the API exactly; `apiSurface.test.ts` re-derives
 * it and fails if this was not re-run.
 *
 * Reachability from `Comfy`, not "every interface in the folder": the folder
 * also holds the registry's own bookkeeping shapes, and scanning those put
 * `handleFor`, `handleForNode` and `active` in the published set — so the
 * harness would wave through a conversion calling an internal.
 *
 * Names are followed whether or not they are exported. Several published types
 * are un-exported to satisfy knip, and dropping them took their members out of
 * the set, which made the harness reject correct conversions.
 */
import { readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

function sourceDirectory() {
  return fileURLToPath(new URL('../../src/platform/nodeApi/', import.meta.url))
}

const ROOT_TYPE = 'Comfy'

/** Declarations that carry members, by name, across the whole directory. */
function declarationsByName(dir) {
  const byName = new Map()
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
    const source = ts.createSourceFile(
      file,
      readFileSync(join(dir, file), 'utf8'),
      ts.ScriptTarget.ES2023,
      true
    )
    for (const statement of source.statements) {
      if (
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)
      ) {
        const existing = byName.get(statement.name.text) ?? []
        existing.push(statement)
        byName.set(statement.name.text, existing)
      }
    }
  }
  return byName
}

function declarationMemberName(node) {
  if (
    !ts.isPropertySignature(node) &&
    !ts.isMethodSignature(node) &&
    !ts.isPropertyDeclaration(node) &&
    !ts.isMethodDeclaration(node)
  )
    return undefined
  if (
    !node.name ||
    !ts.isIdentifier(node.name) ||
    node.name.text.startsWith('__')
  )
    return undefined
  return node.name.text
}

function referencedTypeName(node) {
  if (!ts.isTypeReferenceNode(node)) return undefined
  return ts.isIdentifier(node.typeName)
    ? node.typeName.text
    : node.typeName.right.text
}

function inheritedTypeName(node) {
  if (
    !ts.isExpressionWithTypeArguments(node) ||
    !ts.isIdentifier(node.expression)
  ) {
    return undefined
  }
  return node.expression.text
}

function walk(node, members, referenced) {
  const member = declarationMemberName(node)
  if (member) members.add(member)
  const reference = referencedTypeName(node)
  if (reference) referenced.add(reference)
  const inherited = inheritedTypeName(node)
  if (inherited) referenced.add(inherited)
  node.forEachChild((child) => walk(child, members, referenced))
}

/** Names of every declaration reachable from the `Comfy` root. */
export function reachableDeclarationNames(dir = sourceDirectory()) {
  return walkFromRoot(dir).seen
}

export function deriveApiMembers(dir = sourceDirectory()) {
  return walkFromRoot(dir).members
}

function walkFromRoot(dir) {
  const byName = declarationsByName(dir)
  const members = new Set()
  const seen = new Set()
  const queue = [ROOT_TYPE]

  while (queue.length) {
    const name = queue.pop()
    if (seen.has(name)) continue
    seen.add(name)
    for (const declaration of byName.get(name) ?? []) {
      const referenced = new Set()
      walk(declaration, members, referenced)
      for (const next of referenced) {
        if (!seen.has(next) && byName.has(next)) queue.push(next)
      }
    }
  }
  return { members, seen }
}

const entryPath = process.argv[1]
if (
  entryPath &&
  realpathSync(fileURLToPath(import.meta.url)) ===
    realpathSync(resolve(entryPath))
) {
  const directory = sourceDirectory()
  const names = [...deriveApiMembers(directory)].sort()
  const header = readFileSync(join(directory, 'apiSurface.ts'), 'utf8').split(
    'export const API_MEMBERS'
  )[0]
  writeFileSync(
    join(directory, 'apiSurface.ts'),
    `${header}export const API_MEMBERS: ReadonlySet<string> = new Set([\n${names
      .map((n) => `  '${n}'`)
      .join(',\n')}\n])\n`
  )
  console.error(`${names.length} members`)
}
