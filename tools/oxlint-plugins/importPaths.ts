import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { RuleTester } from 'oxlint/plugins-dev'

type Rule = Parameters<RuleTester['run']>[1]
type Context = Parameters<Extract<Rule, { create: unknown }>['create']>[0]
type Node = Parameters<Context['sourceCode']['getScope']>[0]
type SourceNode = Extract<Node, { type: 'Literal' }>
type JsonValue = Context['options'][number]

interface Zone {
  readonly target: string
  readonly from: string | readonly string[]
  readonly message?: string
}

const SRC_ALIAS = '@/'

function importSource(node: Node): SourceNode | undefined {
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
      return node.source
    case 'ExportNamedDeclaration':
      return node.source ?? undefined
    case 'ImportExpression':
      return node.source.type === 'Literal' ? node.source : undefined
  }
}

function forEachImport(visit: (source: SourceNode, specifier: string) => void) {
  function check(node: Node) {
    const source = importSource(node)
    if (source && typeof source.value === 'string') visit(source, source.value)
  }
  return {
    ImportDeclaration: check,
    ExportAllDeclaration: check,
    ExportNamedDeclaration: check,
    ImportExpression: check
  }
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../')
}

function resolveImport(
  context: Context,
  specifier: string
): string | undefined {
  if (isRelative(specifier)) {
    return path.resolve(path.dirname(context.filename), specifier)
  }
  if (specifier.startsWith(SRC_ALIAS)) {
    return path.resolve(context.cwd, 'src', specifier.slice(SRC_ALIAS.length))
  }
}

function isInside(directory: string, file: string): boolean {
  const relative = path.relative(directory, file)
  return (
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  )
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStringArray(value: JsonValue): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseZone(value: JsonValue): Zone | undefined {
  if (!isRecord(value)) return
  const { target, from, message } = value
  if (typeof target !== 'string') return
  if (typeof from !== 'string' && !isStringArray(from)) return
  return {
    target,
    from,
    message: typeof message === 'string' ? message : undefined
  }
}

function zonesOf(options: Context['options']): readonly Zone[] {
  const [config] = options
  if (!isRecord(config) || !Array.isArray(config.zones)) return []
  return config.zones.flatMap((zone) => parseZone(zone) ?? [])
}

export const noRestrictedPaths: Rule = {
  meta: {
    schema: [
      {
        type: 'object',
        properties: {
          zones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                target: { type: 'string' },
                from: {
                  anyOf: [
                    { type: 'string' },
                    { type: 'array', items: { type: 'string' } }
                  ]
                },
                message: { type: 'string' }
              },
              required: ['target', 'from'],
              additionalProperties: false
            }
          }
        },
        required: ['zones'],
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const applicableZones = zonesOf(context.options)
      .filter((zone) =>
        isInside(path.resolve(context.cwd, zone.target), context.filename)
      )
      .map((zone) => ({
        from: (typeof zone.from === 'string' ? [zone.from] : zone.from).map(
          (directory) => path.resolve(context.cwd, directory)
        ),
        message: zone.message
      }))
    if (applicableZones.length === 0) return {}

    return forEachImport((source, specifier) => {
      const resolved = resolveImport(context, specifier)
      if (resolved === undefined) return
      const zone = applicableZones.find((candidate) =>
        candidate.from.some((directory) => isInside(directory, resolved))
      )
      if (!zone) return
      context.report({
        node: source,
        message: [
          `Unexpected path "${specifier}" imported in restricted zone.`,
          zone.message
        ]
          .filter(Boolean)
          .join(' ')
      })
    })
  }
}

const MODULE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.d.ts',
  '.vue',
  '.js',
  '.mjs'
]

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

function isDirectory(file: string): boolean {
  try {
    return statSync(file).isDirectory()
  } catch {
    return false
  }
}

// A specifier such as `../ui` may name either `ui.ts` or the `ui/` directory;
// only the file form tells how many parent segments the import really needs.
function resolveModuleFile(resolved: string): string | undefined {
  if (isFile(resolved)) return resolved
  const withExtension = MODULE_EXTENSIONS.map(
    (extension) => resolved + extension
  ).find(isFile)
  if (withExtension !== undefined) return withExtension
  if (isDirectory(resolved)) return resolved
}

function countParents(segments: readonly string[]): number {
  return segments.filter((segment) => segment === '..').length
}

function toRelativeSpecifier(specifier: string): string {
  return specifier.startsWith('.') ? specifier : `./${specifier}`
}

export const noUselessPathSegments: Rule = {
  meta: { fixable: 'code' },
  create(context) {
    const currentDir = path.dirname(context.filename)

    return forEachImport((source, specifier) => {
      if (!specifier.startsWith('.')) return
      function report(proposed: string) {
        const quote = context.sourceCode.getText(source)[0]
        context.report({
          node: source,
          message: `Useless path segments for "${specifier}", should be "${proposed}"`,
          fix: (fixer) =>
            fixer.replaceText(source, `${quote}${proposed}${quote}`)
        })
      }

      const normalized = toRelativeSpecifier(path.posix.normalize(specifier))
      if (normalized !== specifier) {
        report(normalized)
        return
      }
      if (specifier.startsWith('./')) return

      const resolved = resolveModuleFile(path.resolve(currentDir, specifier))
      if (resolved === undefined) return
      const expectedParents = countParents(
        path.relative(currentDir, resolved).split(path.sep)
      )
      const segments = specifier.split('/')
      const actualParents = countParents(segments)
      const excess = actualParents - expectedParents
      if (excess <= 0) return
      report(
        toRelativeSpecifier(
          [
            ...segments.slice(0, expectedParents),
            ...segments.slice(actualParents + excess)
          ].join('/')
        )
      )
    })
  }
}

const packageRoots = new Map<string, string | undefined>()

function packageRootOf(directory: string): string | undefined {
  if (packageRoots.has(directory)) return packageRoots.get(directory)
  const parent = path.dirname(directory)
  const root = existsSync(path.join(directory, 'package.json'))
    ? directory
    : parent === directory
      ? undefined
      : packageRootOf(parent)
  packageRoots.set(directory, root)
  return root
}

function packageName(root: string): string {
  const manifest = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8')
  ) as { name?: string }
  return manifest.name ?? path.basename(root)
}

export const noRelativePackages: Rule = {
  create(context) {
    const ownRoot = packageRootOf(path.dirname(context.filename))

    return forEachImport((source, specifier) => {
      if (!isRelative(specifier)) return
      const resolved = path.resolve(path.dirname(context.filename), specifier)
      const importedRoot = packageRootOf(
        isDirectory(resolved) ? resolved : path.dirname(resolved)
      )
      if (importedRoot === undefined || importedRoot === ownRoot) return
      const proposed = [
        packageName(importedRoot),
        ...path.relative(importedRoot, resolved).split(path.sep)
      ]
        .filter((segment) => segment !== '')
        .join('/')
      context.report({
        node: source,
        message: `Relative import from another package is not allowed. Use \`${proposed}\` instead of \`${specifier}\``
      })
    })
  }
}
