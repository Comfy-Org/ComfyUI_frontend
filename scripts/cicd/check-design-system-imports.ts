import { globSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'

const packageDir = 'packages/design-system'

const manifest: {
  name: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
} = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))

const declared = new Set([
  manifest.name,
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {})
])

const specifierPattern =
  /^\s*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"\s]+)['"]|^\s*import\s*['"]([^'"\s]+)['"]|\bimport\(\s*['"]([^'"\s]+)['"]\s*\)/gm

function packageName(specifier: string): string {
  const [scope, name] = specifier.split('/')
  return scope.startsWith('@') ? `${scope}/${name}` : scope
}

function isExternal(specifier: string): boolean {
  return (
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('node:') &&
    !builtinModules.includes(packageName(specifier))
  )
}

const undeclared = globSync(`${packageDir}/dist/**/*.{js,d.ts}`).flatMap(
  (file) =>
    [...readFileSync(file, 'utf8').matchAll(specifierPattern)]
      .map((match) => match.slice(1).find(Boolean) ?? '')
      .filter(isExternal)
      .filter((specifier) => !declared.has(packageName(specifier)))
      .map((specifier) => `${file}: ${specifier}`)
)

if (undeclared.length > 0) {
  process.stderr.write(
    `Compiled design system files import undeclared packages:\n${undeclared.join('\n')}\n`
  )
  process.exit(1)
}
process.stdout.write('Every compiled import is a declared dependency.\n')
