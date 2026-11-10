import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const manifestSchema = z.object({
  name: z.string().min(1),
  dependencies: z.record(z.string(), z.string()).default({}),
  optionalDependencies: z.record(z.string(), z.string()).default({}),
  peerDependencies: z.record(z.string(), z.string()).default({}),
  peerDependenciesMeta: z
    .record(z.string(), z.object({ optional: z.boolean().default(false) }))
    .default({})
})
const workspaceSchema = manifestSchema.extend({ path: z.string().min(1) })
const dependencySchema = z.object({
  path: z.string().min(1),
  dependencies: z.record(z.string(), z.unknown()).default({}),
  optionalDependencies: z.record(z.string(), z.unknown()).default({})
})

function findInstalledPackage(
  name: string,
  directory: string
): string | undefined {
  const path = join(directory, 'node_modules', name)
  if (existsSync(path)) return path
  const parent = dirname(directory)
  return parent === directory ? undefined : findInstalledPackage(name, parent)
}

export function generateWorkspaceLicenseExclusions(
  workspaceListing: unknown,
  productionListing: unknown
): string {
  const workspaces = z.array(workspaceSchema).nonempty().parse(workspaceListing)
  const productionRoots = z
    .array(dependencySchema)
    .nonempty()
    .parse(productionListing)
  const workspacePaths = new Map(
    workspaces.map(({ name, path }) => [name, realpathSync(path)])
  )
  const expandedManifests = new Set<string>()

  function visit(value: unknown, optional = false): void {
    const dependency = dependencySchema.parse(value)
    if (optional && !existsSync(dependency.path)) return
    const path = realpathSync(dependency.path)

    const manifest = manifestSchema.parse(
      JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'))
    )
    const { name, optionalDependencies } = manifest
    const workspacePath = workspacePaths.get(name)
    if (workspacePath && workspacePath !== path) {
      throw new Error(
        `Cannot exclude workspace package ${name}: external production dependency at ${path} shares its name with ${workspacePath}`
      )
    }
    for (const [name, child] of Object.entries(dependency.dependencies)) {
      visit(child, Object.hasOwn(optionalDependencies, name))
    }
    for (const child of Object.values(dependency.optionalDependencies))
      visit(child, true)

    visitInstalledDependencies(path, manifest)
  }

  function visitInstalledDependencies(
    path: string,
    {
      dependencies,
      optionalDependencies,
      peerDependencies,
      peerDependenciesMeta
    }: z.infer<typeof manifestSchema>
  ): void {
    if (expandedManifests.has(path)) return
    expandedManifests.add(path)

    for (const name of Object.keys({
      ...peerDependencies,
      ...dependencies,
      ...optionalDependencies
    })) {
      visit(
        {
          path:
            findInstalledPackage(name, path) ?? join(path, 'node_modules', name)
        },
        Object.hasOwn(optionalDependencies, name) ||
          (!Object.hasOwn(dependencies, name) &&
            peerDependenciesMeta[name]?.optional)
      )
    }
  }

  productionRoots.forEach((root) => visit(root))
  return [...workspacePaths.keys()].sort().join(';')
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const options = {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  } as const
  process.stdout.write(
    generateWorkspaceLicenseExclusions(
      JSON.parse(
        execFileSync('pnpm', ['list', '-r', '--depth', '-1', '--json'], options)
      ),
      JSON.parse(
        execFileSync(
          'pnpm',
          ['list', '--prod', '--depth', 'Infinity', '--json'],
          options
        )
      )
    )
  )
}
