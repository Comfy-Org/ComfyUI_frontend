import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.vue', '.css']

type ImportEdge = {
  importer: string
  imported: string
}

export type StartupBoundaryViolation = {
  forbiddenModule: string
  importChain: string[]
}

function isRuntimeImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause
  if (!clause) return true
  if (clause.isTypeOnly) return false
  if (clause.name) return true

  const bindings = clause.namedBindings
  if (!bindings) return true
  if (ts.isNamespaceImport(bindings)) return true
  return bindings.elements.some((element) => !element.isTypeOnly)
}

function getTypeScriptImports(source: string, filename: string): string[] {
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const imports: string[] = []

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      isRuntimeImport(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      imports.push(statement.moduleSpecifier.text)
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      imports.push(statement.moduleSpecifier.text)
    }
  }

  return imports
}

function getStaticImports(filename: string): string[] {
  const source = readFileSync(filename, 'utf8')

  if (filename.endsWith('.css')) {
    return [...source.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)].map(
      (match) => match[1]
    )
  }

  if (!filename.endsWith('.vue')) {
    return getTypeScriptImports(source, filename)
  }

  const { descriptor } = parse(source, { filename })
  return [descriptor.script?.content, descriptor.scriptSetup?.content]
    .filter((script): script is string => script !== undefined)
    .flatMap((script) => getTypeScriptImports(script, filename))
}

function resolveSourceImport(
  workspaceRoot: string,
  importer: string,
  specifier: string
): string | undefined {
  const withoutQuery = specifier.split('?', 1)[0]
  let candidate: string

  if (withoutQuery.startsWith('@/')) {
    candidate = path.join(workspaceRoot, 'src', withoutQuery.slice(2))
  } else if (withoutQuery.startsWith('.')) {
    candidate = path.resolve(path.dirname(importer), withoutQuery)
  } else {
    return
  }

  const candidates = [
    candidate,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) =>
      path.join(candidate, `index${extension}`)
    )
  ]
  return candidates.find(
    (resolved) => existsSync(resolved) && statSync(resolved).isFile()
  )
}

function getImportEdges(workspaceRoot: string, importer: string): ImportEdge[] {
  return getStaticImports(importer).flatMap((specifier) => {
    const imported = resolveSourceImport(workspaceRoot, importer, specifier)
    return imported ? [{ importer, imported }] : []
  })
}

export function findStartupBoundaryViolations({
  workspaceRoot,
  roots,
  isForbidden
}: {
  workspaceRoot: string
  roots: string[]
  isForbidden: (relativePath: string) => boolean
}): StartupBoundaryViolation[] {
  const absoluteRoots = roots.map((root) => path.join(workspaceRoot, root))
  const queue = absoluteRoots.map((root) => ({ module: root, chain: [root] }))
  const visited = new Set<string>()
  const violations = new Map<string, StartupBoundaryViolation>()

  while (queue.length) {
    const current = queue.shift()
    if (!current || visited.has(current.module)) continue
    visited.add(current.module)

    for (const edge of getImportEdges(workspaceRoot, current.module)) {
      const chain = [...current.chain, edge.imported]
      const relativePath = path.relative(workspaceRoot, edge.imported)
      if (isForbidden(relativePath)) {
        if (!violations.has(relativePath)) {
          violations.set(relativePath, {
            forbiddenModule: relativePath,
            importChain: chain.map((filename) =>
              path.relative(workspaceRoot, filename)
            )
          })
        }
        continue
      }
      queue.push({ module: edge.imported, chain })
    }
  }

  return [...violations.values()]
}
