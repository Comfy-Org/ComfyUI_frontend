/**
 * Builds the published API's type surface as a single `.d.ts`.
 *
 * Dropped into every working copy as `v2/comfy-api.d.ts`, so an agent reads the
 * contract it is coding against instead of a prose list of capability names.
 * The prose list drifted — the doc said eleven capabilities while the code had
 * eighteen, and twelve files were punted against API that already existed.
 * Types cannot drift: they are the thing being described.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const DIR = new URL('../../src/platform/nodeApi/', import.meta.url).pathname

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

export function buildApiDts(directory = DIR) {
  const files = readdirSync(directory)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort()

  const sections = []
  for (const file of files) {
    const found = declarations(readFileSync(join(directory, file), 'utf8'))
    if (!found.length) continue
    sections.push(
      `// ─── ${file} ${'─'.repeat(Math.max(0, 60 - file.length))}\n\n` +
        found.map((d) => d.text).join('\n\n')
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
    sections.join('\n\n')
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(buildApiDts())
}
