import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type TypeScript from 'typescript'
import { fileURLToPath } from 'node:url'

const GENERATED_PACKAGE = '@comfyorg/ingest-types'
const PLUGIN_SOURCE = 'tools/oxlint-plugins/comfyIngestTypes.ts'
const MIN_EXPECTED_EXPORTS = 100

const requireFrom = createRequire(import.meta.url)

function loadTypeScript(): typeof TypeScript {
  return requireFrom('typescript')
}

interface Identifier {
  readonly type: 'Identifier'
  readonly name: string
}

interface QualifiedName {
  readonly type: 'TSQualifiedName'
  readonly left?: Identifier
  readonly right?: Identifier
}

interface TypeNode {
  readonly type: string
  readonly typeName?: Identifier | QualifiedName
  readonly types?: readonly TypeNode[]
  readonly typeArguments?: { readonly params?: readonly TypeNode[] }
  readonly objectType?: TypeNode
}

interface ImportDeclaration {
  readonly source: { readonly value: string }
  readonly specifiers?: readonly { readonly local?: Identifier }[]
}

interface NamedDeclaration {
  readonly id: Identifier
}

interface TypeAliasDeclaration extends NamedDeclaration {
  readonly typeAnnotation?: TypeNode
}

interface RuleContext {
  report(descriptor: { node: unknown; message: string }): void
}

interface ParsedSourceFile {
  readonly parseDiagnostics?: readonly TypeScript.Diagnostic[]
}

function barrelProblem(problem: string): Error {
  return new Error(
    `${problem} in ${GENERATED_PACKAGE}. Update ${PLUGIN_SOURCE} to handle the generated barrel's current format.`
  )
}

function unsupportedDeclaration(text: string): Error {
  return barrelProblem(`Unsupported export declaration '${firstLineOf(text)}'`)
}

function firstLineOf(text: string): string {
  return text.split('\n', 1)[0].trim().slice(0, 80)
}

function syntaxErrorsIn(
  ts: typeof TypeScript,
  barrel: TypeScript.SourceFile
): string[] {
  const parsed = barrel as TypeScript.SourceFile & ParsedSourceFile
  return (parsed.parseDiagnostics ?? []).map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
  )
}

function declaresItsOwnExport(
  ts: typeof TypeScript,
  statement: TypeScript.Statement
): boolean {
  if (ts.isExportAssignment(statement)) return true
  if (ts.isNamespaceExportDeclaration(statement)) return true
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
  )
}

function isTypeOnlyReExport(
  ts: typeof TypeScript,
  statement: TypeScript.ExportDeclaration
): statement is TypeScript.ExportDeclaration & {
  exportClause: TypeScript.NamedExports
} {
  const clause = statement.exportClause
  return (
    statement.isTypeOnly &&
    statement.moduleSpecifier !== undefined &&
    clause !== undefined &&
    ts.isNamedExports(clause)
  )
}

export function collectExportedNames(source: string): Set<string> {
  const ts = loadTypeScript()
  const barrel = ts.createSourceFile(
    'barrel.ts',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  )

  const syntaxErrors = syntaxErrorsIn(ts, barrel)
  if (syntaxErrors.length > 0) {
    throw barrelProblem(`Unparsable source (${syntaxErrors[0]})`)
  }

  const names = new Set<string>()
  for (const statement of barrel.statements) {
    if (!ts.isExportDeclaration(statement)) {
      if (declaresItsOwnExport(ts, statement)) {
        throw unsupportedDeclaration(statement.getText(barrel))
      }
      continue
    }
    if (!isTypeOnlyReExport(ts, statement)) {
      throw unsupportedDeclaration(statement.getText(barrel))
    }
    for (const element of statement.exportClause.elements) {
      names.add(element.name.text)
    }
  }
  return names
}

function parseGeneratedTypeNames(): ReadonlySet<string> {
  const barrelPath = fileURLToPath(import.meta.resolve(GENERATED_PACKAGE))
  const names = collectExportedNames(readFileSync(barrelPath, 'utf8'))

  if (names.size < MIN_EXPECTED_EXPORTS) {
    throw new Error(
      `Parsed only ${names.size} export names from ${barrelPath}, expected at least ${MIN_EXPECTED_EXPORTS}. The generated barrel format likely changed; update ${PLUGIN_SOURCE}.`
    )
  }
  return names
}

let cachedNames: ReadonlySet<string> | undefined

function generatedTypeNames(): ReadonlySet<string> {
  cachedNames ??= parseGeneratedTypeNames()
  return cachedNames
}

function isZodInference(annotation: TypeNode): boolean {
  if (annotation.type !== 'TSTypeReference') return false
  const typeName = annotation.typeName
  if (typeName?.type !== 'TSQualifiedName') return false
  return typeName.left?.name === 'z' && typeName.right?.name === 'infer'
}

function referencesGenerated(
  node: TypeNode,
  generatedLocalNames: ReadonlySet<string>
): boolean {
  if (node.type !== 'TSTypeReference') return false
  const typeName = node.typeName
  if (
    typeName?.type === 'Identifier' &&
    generatedLocalNames.has(typeName.name)
  ) {
    return true
  }
  return (node.typeArguments?.params ?? []).some((param) =>
    referencesGenerated(param, generatedLocalNames)
  )
}

function isDerivedRatherThanRedeclared(
  annotation: TypeNode,
  generatedLocalNames: ReadonlySet<string>
): boolean {
  if (isZodInference(annotation)) return true
  if (annotation.type === 'TSIndexedAccessType') return true
  if (referencesGenerated(annotation, generatedLocalNames)) return true
  if (annotation.type !== 'TSIntersectionType') return false
  return (annotation.types ?? []).some((member) =>
    referencesGenerated(member, generatedLocalNames)
  )
}

function duplicateMessage(name: string): string {
  return `'${name}' is already exported from ${GENERATED_PACKAGE}. Import it instead of redeclaring — local copies drift from the API contract (see docs/guidance/typescript.md).`
}

const noDuplicateIngestType = {
  create(context: RuleContext) {
    const generatedLocalNames = new Set<string>()

    const reportIfDuplicate = (node: NamedDeclaration) => {
      const { name } = node.id
      if (!generatedTypeNames().has(name)) return
      context.report({ node: node.id, message: duplicateMessage(name) })
    }

    return {
      ImportDeclaration(node: ImportDeclaration) {
        if (node.source.value !== GENERATED_PACKAGE) return
        for (const specifier of node.specifiers ?? []) {
          if (specifier.local) generatedLocalNames.add(specifier.local.name)
        }
      },
      TSInterfaceDeclaration(node: NamedDeclaration) {
        reportIfDuplicate(node)
      },
      TSTypeAliasDeclaration(node: TypeAliasDeclaration) {
        const annotation = node.typeAnnotation
        if (
          annotation &&
          isDerivedRatherThanRedeclared(annotation, generatedLocalNames)
        ) {
          return
        }
        reportIfDuplicate(node)
      }
    }
  }
}

export default {
  meta: { name: 'comfy' },
  rules: { 'no-duplicate-ingest-type': noDuplicateIngestType }
}
