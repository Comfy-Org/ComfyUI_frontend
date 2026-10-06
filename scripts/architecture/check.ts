import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { markdownTable } from 'markdown-table'
import {
  LanguageVariant,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  createScanner,
  createSourceFile,
  forEachChild,
  isCallExpression,
  isExportDeclaration,
  isImportDeclaration,
  isStringLiteral
} from 'typescript'
import type { Node } from 'typescript'

export type Enforcement = 'inventory' | 'baseline' | 'error'
export type ArchitecturalRole =
  | 'application'
  | 'domain'
  | 'infrastructure'
  | 'integration'
  | 'presentation'
export type EdgeClassification = 'allowed' | 'forbidden' | 'legacy'

interface DomainModule {
  path: string
  role: ArchitecturalRole
}

interface CharacterizationScenario {
  name: string
  checks: string[]
}

export interface DomainRecord {
  $schema?: string
  schemaVersion: 1
  id: string
  capability: string
  description: string
  expectedFileCount: number
  modules: DomainModule[]
  publicEntryPoints: string[]
  owners: string[]
  allowedDependencies: string[]
  allowedConsumers: string[]
  characterizationScenarios: CharacterizationScenario[]
  adrs: string[]
  compatibilityPromises: string[]
  enforcement: {
    deepImports: Enforcement
    dependencies: Enforcement
  }
}

export interface ArchitectureException {
  exactFingerprints: string[]
  id: string
  owner: string
  rationale: string
  sunset: string
  removalCriteria: string
  fingerprintPrefixes: string[]
}

export type ViolationKind =
  | 'anonymous-suppression'
  | 'deep-import'
  | 'forbidden-edge'
  | 'named-suppression'
  | 'unclassified-module'

export interface Violation {
  exceptionId?: string
  kind: ViolationKind
  fingerprint: string
  detail: string
  maturity: Enforcement
  source: string
}

export interface ClassifiedEdge {
  classification: EdgeClassification
  source: string
  sourceDomain?: string
  sourceRole?: ArchitecturalRole
  specifier: string
  target: string
  targetDomain?: string
  targetRole?: ArchitecturalRole
}

export interface Census {
  sourceFiles: number
  parsedDeclarations: number
  resolvedInternalDeclarations: number
  resolvedInternalSources: number
  unresolvedInternal: Array<{ source: string; specifier: string }>
  edges: ClassifiedEdge[]
  violations: Violation[]
}

interface ImportEdge {
  source: string
  specifier: string
  target?: string
}

interface ArchitectureConfiguration {
  exceptions: ArchitectureException[]
  records: DomainRecord[]
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.vue']
const ARCHITECTURE_RULE = 'comfy/no-restricted-paths'
const ROLE_DEPENDENCIES: Record<ArchitecturalRole, ArchitecturalRole[]> = {
  domain: ['domain'],
  application: ['application', 'domain', 'infrastructure'],
  infrastructure: ['application', 'domain', 'infrastructure'],
  presentation: ['application', 'domain', 'presentation'],
  integration: [
    'application',
    'domain',
    'infrastructure',
    'integration',
    'presentation'
  ]
}
const DOMAIN_KEYS = [
  '$schema',
  'schemaVersion',
  'id',
  'capability',
  'description',
  'expectedFileCount',
  'modules',
  'publicEntryPoints',
  'owners',
  'allowedDependencies',
  'allowedConsumers',
  'characterizationScenarios',
  'adrs',
  'compatibilityPromises',
  'enforcement'
]
const EXCEPTION_KEYS = [
  'exactFingerprints',
  'id',
  'owner',
  'rationale',
  'sunset',
  'removalCriteria',
  'fingerprintPrefixes'
]

const toPosix = (value: string): string => value.replaceAll('\\', '/')
const lexicalCompare = (left: string, right: string): number => {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })

const exactKeys = (value: object, expected: string[], label: string): void => {
  const actual = Object.keys(value).sort()
  const allowed = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(allowed)) {
    throw new Error(`${label} has invalid fields: ${actual.join(', ')}`)
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const uniqueStrings = (value: unknown, label: string): string[] => {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string') ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${label} must be an array of unique strings`)
  }
  return value
}

const matchesPath = (filename: string, pattern: string): boolean =>
  pattern.endsWith('/**')
    ? filename.startsWith(pattern.slice(0, -2))
    : filename === pattern

const owningDomains = (
  filename: string,
  records: DomainRecord[]
): DomainRecord[] =>
  records.filter((record) =>
    record.modules.some(({ path }) => matchesPath(filename, path))
  )

const owningDomain = (
  filename: string,
  records: DomainRecord[]
): DomainRecord | undefined =>
  records.find((record) =>
    record.modules.some(({ path }) => matchesPath(filename, path))
  )

const owningRole = (
  filename: string,
  record: DomainRecord | undefined
): ArchitecturalRole | undefined =>
  record?.modules.find(({ path }) => matchesPath(filename, path))?.role

const scriptKind = (language: string): ScriptKind => {
  if (language === 'tsx') return ScriptKind.TSX
  if (language === 'jsx') return ScriptKind.JSX
  if (language === 'js') return ScriptKind.JS
  return ScriptKind.TS
}

const scriptBodies = (
  filename: string,
  source: string
): Array<{ body: string; kind: ScriptKind }> => {
  if (!filename.endsWith('.vue')) {
    const extension = filename.split('.').at(-1) ?? 'ts'
    return [{ body: source, kind: scriptKind(extension) }]
  }
  return [...source.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(
    ([, attributes = '', body]) => {
      const language = attributes.match(/\blang=["'](\w+)["']/)?.[1] ?? 'js'
      return { body, kind: scriptKind(language) }
    }
  )
}

export const parseImportSpecifiers = (
  filename: string,
  source: string
): string[] =>
  scriptBodies(filename, source).flatMap(({ body, kind }) => {
    const sourceFile = createSourceFile(
      filename,
      body,
      ScriptTarget.Latest,
      false,
      kind
    )
    const specifiers: string[] = []
    const visit = (node: Node): void => {
      if (
        (isImportDeclaration(node) || isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        isStringLiteral(node.moduleSpecifier)
      ) {
        specifiers.push(node.moduleSpecifier.text)
      } else if (
        isCallExpression(node) &&
        node.expression.kind === SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        isStringLiteral(node.arguments[0])
      ) {
        specifiers.push(node.arguments[0].text)
      }
      forEachChild(node, visit)
    }
    visit(sourceFile)
    return specifiers
  })

const resolveInternalImport = (
  source: string,
  specifier: string,
  sourceFiles: Set<string>
): string | undefined => {
  const pathSpecifier = specifier.replace(/[?#].*$/, '')
  const unresolved = pathSpecifier.startsWith('@/')
    ? `src/${pathSpecifier.slice(2)}`
    : pathSpecifier.startsWith('.')
      ? toPosix(join(dirname(source), pathSpecifier))
      : undefined
  if (!unresolved) return undefined
  return [
    unresolved,
    ...SOURCE_EXTENSIONS.map((extension) => `${unresolved}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) =>
      join(unresolved, `index${extension}`)
    )
  ]
    .map(toPosix)
    .find((candidate) => sourceFiles.has(candidate))
}

const suppressionViolations = (
  filename: string,
  source: string
): Violation[] => {
  const occurrences = new Map<string, number>()
  return eslintComments(filename, source)
    .filter(disablesArchitectureRule)
    .map((comment) => {
      const exceptionId = comment.match(
        /architecture-exception:\s*(DDD-EX-\d{3})/
      )?.[1]
      const fingerprintBase = exceptionId
        ? `named-suppression:${exceptionId}:${filename}:${ARCHITECTURE_RULE}`
        : `anonymous-suppression:${filename}:${ARCHITECTURE_RULE}`
      const occurrence = (occurrences.get(fingerprintBase) ?? 0) + 1
      occurrences.set(fingerprintBase, occurrence)
      return {
        ...(exceptionId ? { exceptionId } : {}),
        kind: exceptionId
          ? ('named-suppression' as const)
          : ('anonymous-suppression' as const),
        fingerprint: `${fingerprintBase}#${occurrence}`,
        detail: exceptionId
          ? `${filename} suppresses ${ARCHITECTURE_RULE} under ${exceptionId}`
          : `${filename} suppresses ${ARCHITECTURE_RULE} without an architecture-exception identifier`,
        maturity: 'baseline' as const,
        source: filename
      }
    })
}

const eslintComments = (filename: string, source: string): string[] =>
  scriptBodies(filename, source).flatMap(({ body, kind }) => {
    const variant = [ScriptKind.JSX, ScriptKind.TSX].includes(kind)
      ? LanguageVariant.JSX
      : LanguageVariant.Standard
    const scanner = createScanner(ScriptTarget.Latest, false, variant, body)
    const comments: string[] = []
    for (
      let token = scanner.scan();
      token !== SyntaxKind.EndOfFileToken;
      token = scanner.scan()
    )
      if (
        token === SyntaxKind.SingleLineCommentTrivia ||
        token === SyntaxKind.MultiLineCommentTrivia
      )
        comments.push(scanner.getTokenText())
    return comments
  })

const disablesArchitectureRule = (comment: string): boolean => {
  const directive = comment.match(
    /(?:eslint|oxlint)-disable(?:-next-line|-line)?\b/
  )
  if (!directive?.index && directive?.index !== 0) return false
  const rules = comment
    .slice(directive.index + directive[0].length)
    .split(/--|architecture-exception:/, 1)[0]
    .replace(/\*\//g, '')
    .trim()
  return !rules || rules.split(/[\s,]+/).includes(ARCHITECTURE_RULE)
}

const classifyEdge = (
  edge: ImportEdge & { target: string },
  records: DomainRecord[]
): ClassifiedEdge => {
  const sourceDomain = owningDomain(edge.source, records)
  const targetDomain = owningDomain(edge.target, records)
  const sourceRole = owningRole(edge.source, sourceDomain)
  const targetRole = owningRole(edge.target, targetDomain)
  const rolePermission = rolesPermitDependency(sourceRole, targetRole)
  const classification = edgeClassification(
    edge.target,
    sourceDomain,
    targetDomain,
    rolePermission
  )
  return {
    classification,
    source: edge.source,
    sourceDomain: sourceDomain?.id,
    sourceRole,
    specifier: edge.specifier,
    target: edge.target,
    targetDomain: targetDomain?.id,
    targetRole
  }
}

const rolesPermitDependency = (
  source: ArchitecturalRole | undefined,
  target: ArchitecturalRole | undefined
): boolean => !source || !target || ROLE_DEPENDENCIES[source].includes(target)

const edgeClassification = (
  target: string,
  sourceDomain: DomainRecord | undefined,
  targetDomain: DomainRecord | undefined,
  rolesAllowed: boolean
): EdgeClassification => {
  if (!targetDomain) return 'legacy'
  if (!sourceDomain)
    return targetDomain.publicEntryPoints.includes(target)
      ? 'allowed'
      : 'legacy'
  if (sourceDomain.id === targetDomain.id)
    return rolesAllowed ? 'allowed' : 'forbidden'
  const domainsAllowed =
    sourceDomain.allowedDependencies.includes(targetDomain.id) &&
    targetDomain.allowedConsumers.includes(sourceDomain.id)
  return domainsAllowed && rolesAllowed ? 'allowed' : 'forbidden'
}

const collectSource = (
  repositoryRoot: string,
  filename: string,
  records: DomainRecord[],
  sourceFiles: Set<string>
): { imports: ImportEdge[]; violations: Violation[] } => {
  const domains = owningDomains(filename, records)
  if (domains.length > 1)
    throw new Error(
      `${filename} is owned by overlapping domains: ${domains.map(({ id }) => id).join(', ')}`
    )
  const violations: Violation[] = []
  if (!domains.length)
    violations.push({
      kind: 'unclassified-module',
      fingerprint: `unclassified-module:${filename}`,
      detail: `${filename} is outside every enrolled domain`,
      maturity: 'inventory',
      source: filename
    })
  const source = readFileSync(join(repositoryRoot, filename), 'utf8')
  violations.push(...suppressionViolations(filename, source))
  const imports = parseImportSpecifiers(filename, source).map((specifier) => ({
    source: filename,
    specifier,
    target: resolveInternalImport(filename, specifier, sourceFiles)
  }))
  return { imports, violations }
}

const edgeViolation = (
  edge: ClassifiedEdge,
  records: DomainRecord[],
  occurrences: Map<string, number>
): Violation | undefined => {
  const sourceDomain = records.find(({ id }) => id === edge.sourceDomain)
  const targetDomain = records.find(({ id }) => id === edge.targetDomain)
  if (!targetDomain) return undefined
  const candidate =
    edge.classification === 'forbidden' && sourceDomain
      ? forbiddenEdgeViolation(edge, sourceDomain, targetDomain)
      : deepImportViolation(edge, sourceDomain, targetDomain)
  if (!candidate) return undefined
  const occurrence = (occurrences.get(candidate.base) ?? 0) + 1
  occurrences.set(candidate.base, occurrence)
  return {
    ...candidate.violation,
    fingerprint: `${candidate.base}#${occurrence}`
  }
}

const forbiddenEdgeViolation = (
  edge: ClassifiedEdge,
  sourceDomain: DomainRecord,
  targetDomain: DomainRecord
) => ({
  base: `forbidden-edge:${sourceDomain.id}->${targetDomain.id}:${edge.source}->${edge.target}`,
  violation: {
    kind: 'forbidden-edge' as const,
    detail: `${sourceDomain.id}${edge.sourceRole ? `/${edge.sourceRole}` : ''} may not depend on ${targetDomain.id}${edge.targetRole ? `/${edge.targetRole}` : ''}: ${edge.source} -> ${edge.target}`,
    maturity: sourceDomain.enforcement.dependencies,
    source: edge.source
  }
})

const deepImportViolation = (
  edge: ClassifiedEdge,
  sourceDomain: DomainRecord | undefined,
  targetDomain: DomainRecord
) => {
  if (
    sourceDomain?.id !== targetDomain.id &&
    !targetDomain.publicEntryPoints.includes(edge.target)
  ) {
    return {
      base: `deep-import:${targetDomain.id}:${edge.source}->${edge.target}`,
      violation: {
        kind: 'deep-import' as const,
        detail: `${edge.source} imports internal ${targetDomain.id} module ${edge.target}`,
        maturity: targetDomain.enforcement.deepImports,
        source: edge.source
      }
    }
  }
}

export const censusRepository = (
  repositoryRoot: string,
  records: DomainRecord[]
): Census => {
  const files = walk(join(repositoryRoot, 'src'))
    .map((filename) => toPosix(relative(repositoryRoot, filename)))
    .filter((filename) =>
      SOURCE_EXTENSIONS.some((ext) => filename.endsWith(ext))
    )
    .sort()
  const sourceFiles = new Set(files)
  const violations: Violation[] = []
  const imports: ImportEdge[] = []

  for (const filename of files) {
    const collected = collectSource(
      repositoryRoot,
      filename,
      records,
      sourceFiles
    )
    imports.push(...collected.imports)
    violations.push(...collected.violations)
  }

  const resolved = imports
    .filter((edge): edge is ImportEdge & { target: string } =>
      Boolean(edge.target)
    )
    .map((edge) => classifyEdge(edge, records))
  const unresolvedInternal = imports
    .filter(
      ({ specifier, target }) =>
        !target && (specifier.startsWith('@/') || specifier.startsWith('.'))
    )
    .map(({ source, specifier }) => ({ source, specifier }))
  const occurrences = new Map<string, number>()
  for (const edge of resolved) {
    const violation = edgeViolation(edge, records, occurrences)
    if (violation) violations.push(violation)
  }

  return {
    sourceFiles: files.length,
    parsedDeclarations: imports.length,
    resolvedInternalDeclarations: resolved.length,
    resolvedInternalSources: new Set(resolved.map(({ source }) => source)).size,
    unresolvedInternal,
    edges: resolved,
    violations: violations.sort((left, right) =>
      lexicalCompare(left.fingerprint, right.fingerprint)
    )
  }
}

const validateDomainShape = (
  filename: string,
  record: Partial<DomainRecord>
): void => {
  const enforcement = record.enforcement
  const validMaturity = (value: unknown) =>
    typeof value === 'string' &&
    ['inventory', 'baseline', 'error'].includes(value)
  const identityValid = [
    record.schemaVersion === 1,
    record.id?.match(/^[a-z][a-z0-9-]*$/),
    record.capability,
    record.description
  ].every(Boolean)
  const contractValid = [
    Number.isInteger(record.expectedFileCount),
    Number(record.expectedFileCount) > 0,
    record.modules?.length,
    record.characterizationScenarios?.length,
    record.compatibilityPromises?.length
  ].every(Boolean)
  const enforcementValid = [
    enforcement,
    validMaturity(enforcement?.deepImports),
    validMaturity(enforcement?.dependencies)
  ].every(Boolean)
  if (![identityValid, contractValid, enforcementValid].every(Boolean))
    throw new Error(`${filename} does not match domain.schema.json`)
  exactKeys(
    enforcement as DomainRecord['enforcement'],
    ['deepImports', 'dependencies'],
    `${filename}.enforcement`
  )
}

const validateDomainModule = (
  filename: string,
  value: unknown,
  index: number
): void => {
  const label = `${filename}.modules[${index}]`
  if (!isObject(value)) throw new Error(`${label} is invalid`)
  exactKeys(value, ['path', 'role'], label)
  const module = value as Partial<DomainModule>
  const roles: string[] = Object.keys(ROLE_DEPENDENCIES)
  if (!module.path?.startsWith('src/') || !roles.includes(String(module.role)))
    throw new Error(`${label} is invalid`)
}

const validateScenario = (
  filename: string,
  value: unknown,
  index: number
): void => {
  const label = `${filename}.characterizationScenarios[${index}]`
  if (!isObject(value)) throw new Error(`${label} is invalid`)
  exactKeys(value, ['name', 'checks'], label)
  const scenario = value as Partial<CharacterizationScenario>
  if (
    !scenario.name ||
    !uniqueStrings(scenario.checks, `${label}.checks`).length
  )
    throw new Error(`${label} is invalid`)
}

const normalizeDomainLists = (
  filename: string,
  record: Partial<DomainRecord>
): void => {
  const lists = [
    'publicEntryPoints',
    'owners',
    'allowedDependencies',
    'allowedConsumers',
    'adrs',
    'compatibilityPromises'
  ] as const
  for (const key of lists)
    record[key] = uniqueStrings(record[key], `${filename}.${key}`)
  if (
    !record.owners?.length ||
    record.owners.some((owner) => !owner.startsWith('@'))
  )
    throw new Error(`${filename} requires owners`)
}

const validateDomainRecord = (
  filename: string,
  value: unknown
): DomainRecord => {
  if (!isObject(value)) throw new Error(`${filename} must contain an object`)
  exactKeys(
    value,
    DOMAIN_KEYS.filter((key) => key !== '$schema' || '$schema' in value),
    filename
  )
  const record = value as Partial<DomainRecord>
  validateDomainShape(filename, record)
  for (const [index, module] of (record.modules ?? []).entries())
    validateDomainModule(filename, module, index)
  for (const [index, scenario] of (
    record.characterizationScenarios ?? []
  ).entries())
    validateScenario(filename, scenario, index)
  normalizeDomainLists(filename, record)
  return record as DomainRecord
}

const parseCodeowners = (
  contents: string
): Array<{ pattern: string; owners: string[] }> =>
  contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [pattern, ...owners] = line.split(/\s+/)
      return { pattern: pattern.replace(/^\//, ''), owners }
    })

const ownersForFile = (
  filename: string,
  rules: Array<{ pattern: string; owners: string[] }>
): string[] | undefined =>
  rules
    .filter(({ pattern }) =>
      pattern.endsWith('/')
        ? filename.startsWith(pattern)
        : filename === pattern
    )
    .at(-1)?.owners

const validateDomainReferences = (records: DomainRecord[]): void => {
  const ids = new Set(records.map(({ id }) => id))
  if (ids.size !== records.length) throw new Error('Domain ids must be unique')
  for (const record of records)
    for (const dependency of [
      ...record.allowedDependencies,
      ...record.allowedConsumers
    ])
      if (!ids.has(dependency))
        throw new Error(`${record.id} references unknown domain ${dependency}`)
}

const validateDomainFiles = (
  repositoryRoot: string,
  record: DomainRecord,
  sourceFiles: string[],
  codeowners: ReturnType<typeof parseCodeowners>
): void => {
  for (const module of record.modules)
    validateDomainModuleFiles(record, module, sourceFiles, codeowners)
  const ownedFiles = sourceFiles.filter((file) => owningDomain(file, [record]))
  for (const file of ownedFiles) {
    const matchingModules = record.modules.filter(({ path }) =>
      matchesPath(file, path)
    )
    if (matchingModules.length > 1)
      throw new Error(`${record.id} has overlapping module paths for ${file}`)
  }
  validateDomainReferencedFiles(repositoryRoot, record)
}

const validateDomainModuleFiles = (
  record: DomainRecord,
  module: DomainModule,
  sourceFiles: string[],
  codeowners: ReturnType<typeof parseCodeowners>
): void => {
  const matches = sourceFiles.filter((file) => matchesPath(file, module.path))
  if (!matches.length)
    throw new Error(`${record.id} path matches no source files: ${module.path}`)
  for (const file of matches)
    if (
      JSON.stringify([...(ownersForFile(file, codeowners) ?? [])].sort()) !==
      JSON.stringify([...record.owners].sort())
    )
      throw new Error(`${record.id} owners differ from CODEOWNERS for ${file}`)
}

const validateDomainReferencedFiles = (
  repositoryRoot: string,
  record: DomainRecord
): void => {
  const referencedFiles = [
    ...record.publicEntryPoints,
    ...record.characterizationScenarios.flatMap(({ checks }) => checks),
    ...record.adrs
  ]
  for (const filename of referencedFiles)
    if (!existsSync(join(repositoryRoot, filename)))
      throw new Error(
        `${record.id} referenced file does not exist: ${filename}`
      )
  for (const entry of record.publicEntryPoints)
    if (!owningDomain(entry, [record]))
      throw new Error(`${record.id} public entry point is invalid: ${entry}`)
}

const validateException = (
  value: unknown,
  index: number
): ArchitectureException => {
  const label = `exceptions[${index}]`
  if (!isObject(value)) throw new Error(`${label} is invalid`)
  exactKeys(value, EXCEPTION_KEYS, label)
  const exception = value as Partial<ArchitectureException>
  const prefixes = uniqueStrings(
    exception.fingerprintPrefixes,
    `${label}.fingerprintPrefixes`
  )
  const exact = uniqueStrings(
    exception.exactFingerprints,
    `${label}.exactFingerprints`
  )
  if (!validExceptionMetadata(exception) || ![...prefixes, ...exact].length)
    throw new Error(`${label} does not match exceptions.schema.json`)
  return exception as ArchitectureException
}

const validExceptionMetadata = (
  exception: Partial<ArchitectureException>
): boolean => {
  const validIdentity =
    Boolean(exception.id?.match(/^DDD-EX-\d{3}$/)) &&
    Boolean(exception.owner?.startsWith('@'))
  const validDate =
    Boolean(exception.sunset?.match(/^\d{4}-\d{2}-\d{2}$/)) &&
    !Number.isNaN(Date.parse(`${exception.sunset}T00:00:00Z`))
  return Boolean(
    validIdentity &&
    validDate &&
    exception.rationale &&
    exception.removalCriteria
  )
}

const loadExceptions = (repositoryRoot: string): ArchitectureException[] => {
  const path = join(repositoryRoot, 'docs/architecture/domains/exceptions.json')
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isObject(value))
    throw new Error('exceptions.json must contain an object')
  exactKeys(
    value,
    ['$schema', 'schemaVersion', 'exceptions'],
    'exceptions.json'
  )
  if (value.schemaVersion !== 1 || !Array.isArray(value.exceptions))
    throw new Error('exceptions.json does not match exceptions.schema.json')
  const exceptions = value.exceptions.map(validateException)
  if (new Set(exceptions.map(({ id }) => id)).size !== exceptions.length)
    throw new Error('Exception ids must be unique')
  return exceptions
}

const validateInlineExceptionIds = (
  repositoryRoot: string,
  sourceFiles: string[],
  exceptions: ArchitectureException[]
): void => {
  const ids = new Set(exceptions.map(({ id }) => id))
  for (const filename of sourceFiles) {
    const source = readFileSync(join(repositoryRoot, filename), 'utf8')
    for (const match of source.matchAll(
      /architecture-exception:\s*(DDD-EX-\d{3})/g
    ))
      if (!ids.has(match[1]))
        throw new Error(`${filename} references unknown exception ${match[1]}`)
  }
}

export const loadArchitectureConfiguration = (
  repositoryRoot: string
): ArchitectureConfiguration => {
  const domainDirectory = join(
    repositoryRoot,
    'docs/architecture/domains/records'
  )
  const records = readdirSync(domainDirectory)
    .filter((filename) => filename.endsWith('.domain.json'))
    .sort()
    .map((filename) =>
      validateDomainRecord(
        filename,
        JSON.parse(readFileSync(join(domainDirectory, filename), 'utf8'))
      )
    )
  validateDomainReferences(records)

  const sourceFiles = walk(join(repositoryRoot, 'src'))
    .map((filename) => toPosix(relative(repositoryRoot, filename)))
    .filter((filename) =>
      SOURCE_EXTENSIONS.some((ext) => filename.endsWith(ext))
    )
  const codeowners = parseCodeowners(
    readFileSync(join(repositoryRoot, 'CODEOWNERS'), 'utf8')
  )
  for (const record of records)
    validateDomainFiles(repositoryRoot, record, sourceFiles, codeowners)
  const exceptions = loadExceptions(repositoryRoot)
  validateInlineExceptionIds(repositoryRoot, sourceFiles, exceptions)
  return { exceptions, records }
}

export const findRatchetFailures = (
  violations: Violation[],
  recordedFingerprints: Iterable<string>
): Violation[] => {
  const recorded = new Set(recordedFingerprints)
  return violations.filter(
    ({ fingerprint, maturity }) =>
      maturity === 'error' ||
      (maturity === 'baseline' && !recorded.has(fingerprint))
  )
}

export const validateExceptionCoverage = (
  violations: Violation[],
  exceptions: ArchitectureException[]
): void => {
  for (const violation of violations.filter(
    ({ maturity }) => maturity === 'baseline'
  )) {
    const matches = exceptions.filter(({ exactFingerprints }) =>
      exactFingerprints.includes(violation.fingerprint)
    )
    if (matches.length !== 1) {
      throw new Error(
        `${violation.fingerprint} must match exactly one owned exception`
      )
    }
    if (violation.exceptionId && matches[0].id !== violation.exceptionId) {
      throw new Error(
        `${violation.fingerprint} names ${violation.exceptionId}, but is owned by ${matches[0].id}`
      )
    }
  }
}

const validateNewBaselineCoverage = (
  violations: Violation[],
  exceptions: ArchitectureException[]
): void => {
  for (const violation of violations) {
    const exactOwners = exceptions.filter(({ exactFingerprints }) =>
      exactFingerprints.includes(violation.fingerprint)
    )
    if (
      exactOwners.length !== 1 ||
      (violation.exceptionId && exactOwners[0].id !== violation.exceptionId)
    ) {
      throw new Error(
        `${violation.fingerprint} requires exact owned exception coverage before baseline acceptance`
      )
    }
  }
}

const stableJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2).replace(
    /"fingerprintPrefixes": \[\n\s+"([^"]+)"\n\s+\]/g,
    '"fingerprintPrefixes": ["$1"]'
  )}\n`

const stableCatalog = (
  records: DomainRecord[],
  exceptions: ArchitectureException[]
) => ({
  schemaVersion: 1,
  domains: records.map(({ $schema: _, ...record }) => record),
  exceptions
})

const catalogMarkdown = (records: DomainRecord[]): string =>
  [
    '# Generated frontend domain catalog',
    '',
    'Generated by `pnpm architecture:update`. Do not edit by hand.',
    '',
    markdownTable([
      ['Capability', 'Roles', 'Owners', 'Deep imports', 'Dependencies'],
      ...records.map((record) => [
        record.capability,
        [...new Set(record.modules.map(({ role }) => role))].sort().join(', '),
        record.owners.join(', '),
        record.enforcement.deepImports,
        record.enforcement.dependencies
      ])
    ]),
    ''
  ].join('\n')

const report = (census: Census) => {
  const edgeCounts = Object.fromEntries(
    (['allowed', 'forbidden', 'legacy'] as const).map((classification) => {
      const edges = census.edges.filter(
        (edge) => edge.classification === classification
      )
      return [
        classification,
        {
          declarations: edges.length,
          sources: new Set(edges.map(({ source }) => source)).size
        }
      ]
    })
  )
  const violationCounts = Object.fromEntries(
    (
      [
        'anonymous-suppression',
        'deep-import',
        'forbidden-edge',
        'named-suppression',
        'unclassified-module'
      ] as const
    ).map((kind) => {
      const violations = census.violations.filter(
        (violation) => violation.kind === kind
      )
      return [
        kind,
        {
          occurrences: violations.length,
          sources: new Set(violations.map(({ source }) => source)).size
        }
      ]
    })
  )
  return {
    denominators: {
      sourceFiles: census.sourceFiles,
      parsedDeclarations: census.parsedDeclarations,
      resolvedInternalDeclarations: census.resolvedInternalDeclarations,
      resolvedInternalSources: census.resolvedInternalSources,
      unresolvedInternalDeclarations: census.unresolvedInternal.length
    },
    edgeCounts,
    violationCounts,
    unresolvedInternal: census.unresolvedInternal,
    edges: census.edges
  }
}

type ArchitectureMode = 'accept-baseline' | 'check' | 'report' | 'update'

const synchronizeCatalog = (
  repositoryRoot: string,
  mode: ArchitectureMode,
  records: DomainRecord[],
  exceptions: ArchitectureException[]
): string => {
  const directory = join(repositoryRoot, 'docs/architecture/domains')
  const generated = new Map([
    [
      join(directory, 'catalog.json'),
      stableJson(stableCatalog(records, exceptions))
    ],
    [join(directory, 'catalog.md'), catalogMarkdown(records)]
  ])
  const writes = mode === 'update' || mode === 'accept-baseline'
  for (const [filename, expected] of generated) {
    if (writes) writeFileSync(filename, expected)
    else if (!generatedFileMatches(filename, expected))
      throw new Error(
        `${toPosix(relative(repositoryRoot, filename))} is stale; run pnpm architecture:update`
      )
  }
  return directory
}

const generatedFileMatches = (filename: string, expected: string): boolean => {
  if (!existsSync(filename)) return false
  const actual = readFileSync(filename, 'utf8')
  if (!filename.endsWith('.json')) return actual === expected
  return (
    JSON.stringify(JSON.parse(actual)) === JSON.stringify(JSON.parse(expected))
  )
}

const acceptBaseline = (
  baselinePath: string,
  census: Census,
  exceptions: ArchitectureException[]
): void => {
  const recorded = existsSync(baselinePath)
    ? (
        JSON.parse(readFileSync(baselinePath, 'utf8')) as {
          violations: string[]
        }
      ).violations
    : []
  const recordedSet = new Set(recorded)
  validateNewBaselineCoverage(
    census.violations.filter(
      ({ fingerprint, maturity }) =>
        maturity === 'baseline' && !recordedSet.has(fingerprint)
    ),
    exceptions
  )
  const current = census.violations
    .filter(({ maturity }) => maturity === 'baseline')
    .map(({ fingerprint }) => fingerprint)
  writeFileSync(
    baselinePath,
    stableJson({ schemaVersion: 1, violations: current })
  )
}

const enforceBaseline = (
  baselinePath: string,
  census: Census,
  mode: ArchitectureMode,
  exceptions: ArchitectureException[]
): void => {
  const recorded: { violations: string[] } = JSON.parse(
    readFileSync(baselinePath, 'utf8')
  )
  for (const fingerprint of recorded.violations) {
    const owners = exceptions.filter(({ exactFingerprints }) =>
      exactFingerprints.includes(fingerprint)
    )
    if (owners.length !== 1)
      throw new Error(
        `${fingerprint} in baseline.json requires exact owned exception coverage`
      )
  }
  const failures = findRatchetFailures(census.violations, recorded.violations)
  if (failures.length)
    throw new Error(
      `Architecture ratchet found ${failures.length} new violation(s). ` +
        'Remove the import or use a public entry point. To accept the debt, ' +
        'add each fingerprint to one exception in ' +
        'docs/architecture/domains/exceptions.json and run ' +
        'pnpm architecture:accept-baseline.\n' +
        failures
          .map(({ detail, fingerprint }) => `- ${detail}\n  ${fingerprint}`)
          .join('\n')
    )
  const current = new Set(
    census.violations
      .filter(({ maturity }) => maturity === 'baseline')
      .map(({ fingerprint }) => fingerprint)
  )
  const retained = recorded.violations.filter((fingerprint) =>
    current.has(fingerprint)
  )
  const resolved = recorded.violations.length - retained.length
  if (!resolved) return
  if (mode === 'update') {
    writeFileSync(
      baselinePath,
      stableJson({ schemaVersion: 1, violations: retained })
    )
    return
  }
  throw new Error(
    `baseline.json has ${resolved} resolved fingerprint(s); run pnpm architecture:update`
  )
}

export const runArchitectureCheck = (
  repositoryRoot: string,
  mode: ArchitectureMode
): void => {
  const { records, exceptions } = loadArchitectureConfiguration(repositoryRoot)
  const census = censusRepository(repositoryRoot, records)
  validateExceptionCoverage(census.violations, exceptions)
  if (mode === 'report') {
    process.stdout.write(stableJson(report(census)))
    return
  }

  const directory = synchronizeCatalog(
    repositoryRoot,
    mode,
    records,
    exceptions
  )
  const baselinePath = join(directory, 'baseline.json')
  if (mode === 'accept-baseline') {
    acceptBaseline(baselinePath, census, exceptions)
    return
  }
  enforceBaseline(baselinePath, census, mode, exceptions)
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const mode = process.argv.includes('--accept-baseline')
    ? 'accept-baseline'
    : process.argv.includes('--report')
      ? 'report'
      : process.argv.includes('--update')
        ? 'update'
        : 'check'
  runArchitectureCheck(process.cwd(), mode)
  if (mode !== 'report') process.stdout.write(`Architecture ${mode} passed\n`)
}
