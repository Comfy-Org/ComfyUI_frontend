/**
 * Builds the published API's type surface as a single `.d.ts`.
 *
 * Dropped into every working copy as `v2/comfy-api.d.ts`, so an agent reads the
 * contract it is coding against instead of a prose list of capability names.
 * The prose list drifted — the doc said eleven capabilities while the code had
 * eighteen, and twelve files were punted against API that already existed.
 * Types cannot drift: they are the thing being described.
 */
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { reachableDeclarationNames } from './gen_api_surface.mjs'

function sourceDirectory() {
  return fileURLToPath(new URL('../../src/platform/nodeApi/', import.meta.url))
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

    return [
      {
        name: statement.name.text,
        kind,
        text: statement.getFullText(sourceFile).trim()
      }
    ]
  })
}

export function buildApiDts(directory = sourceDirectory()) {
  const files = readdirSync(directory)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort()

  // Only what a pack can reach from `Comfy`. Scraping every exported
  // declaration published host plumbing — PropSpec, HandleSpec, HandleToken,
  // ResolveOptions — and the reference then documented their private fields.
  const published = reachableDeclarationNames(directory)
  const sections = []
  for (const file of files) {
    const found = declarations(
      readFileSync(join(directory, file), 'utf8')
    ).filter((d) => published.has(d.name))
    if (!found.length) continue
    sections.push(
      `// ─── ${file} ${'─'.repeat(Math.max(0, 60 - file.length))}\n\n` +
        // Emitted without `export`, which keeps the contract a global script
        // rather than a module. A module cannot host an ambient declaration
        // for '/comfy/api/v2.js' — there the same block means augmentation,
        // and augmenting a module that has no other declaration is an error,
        // so the specifier packs actually import stayed untyped.
        found
          .map((d) => d.text.replace(/\bexport (interface|type) /, '$1 '))
          .join('\n\n')
    )
  }

  return (
    `/**\n` +
    ` * The published ComfyUI custom-node API — the complete surface.\n` +
    ` *\n` +
    ` * Generated from src/platform/nodeApi. If a member is not here it does not\n` +
    ` * exist: do not call it, and punt as api-gap naming what is missing.\n` +
    ` * Reached from a converted pack as:\n` +
    ` *\n` +
    ` *   import { comfy } from '/comfy/api/v2.js'\n` +
    ` */\n\n` +
    sections.join('\n\n') +
    // The types above describe the surface but nothing bound them to the
    // specifier packs are told to import, so `comfy` arrived untyped and the
    // contract could not be checked at the one place a pack touches it.
    `\n\n// ─── the published entry point ${'─'.repeat(31)}\n\n` +
    // Wildcard because an ambient declaration may not name a rooted path, and
    // '/comfy/api/v2.js' is one. The pattern still matches only that specifier.
    `declare module '*/comfy/api/v2.js' {\n` +
    `  export const comfy: Comfy\n` +
    `}\n`
  )
}

const entryPath = process.argv[1]
if (
  entryPath &&
  realpathSync(fileURLToPath(import.meta.url)) ===
    realpathSync(resolve(entryPath))
) {
  process.stdout.write(buildApiDts())
}
