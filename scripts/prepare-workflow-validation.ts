import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const packageDir = path.join(repoRoot, 'packages', 'workflow-validation')
const distDir = path.join(packageDir, 'dist')

interface SourcePackage {
  name: string
  version: string
  description?: string
  license?: string
  repository?: string
  homepage?: string
  dependencies?: Record<string, string>
  publishConfig?: Record<string, unknown>
}

interface PnpmWorkspace {
  catalog?: Record<string, string>
}

const sourcePackage = JSON.parse(
  fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
) as SourcePackage

const workspace = parseYaml(
  fs.readFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')
) as PnpmWorkspace
const catalog = workspace.catalog ?? {}

function resolveCatalog(name: string): string {
  const sourceVersion = sourcePackage.dependencies?.[name]
  if (sourceVersion && sourceVersion !== 'catalog:') return sourceVersion
  const version = catalog[name]
  if (!version) {
    throw new Error(
      `Could not resolve catalog version for ${name}. ` +
        `Expected entry under \`catalog:\` in pnpm-workspace.yaml.`
    )
  }
  return version
}

const distPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  description: sourcePackage.description,
  license: sourcePackage.license,
  repository: sourcePackage.repository,
  homepage: sourcePackage.homepage,
  type: 'module',
  main: './index.js',
  module: './index.js',
  types: './index.d.ts',
  exports: {
    '.': {
      types: './index.d.ts',
      import: './index.js'
    },
    './linkRepair': {
      types: './linkRepair.d.ts',
      import: './index.js'
    },
    './linkTopology': {
      types: './linkTopology.d.ts',
      import: './index.js'
    },
    './workflowSchema': {
      types: './workflowSchema.d.ts',
      import: './index.js'
    },
    './serialised': {
      types: './serialised.d.ts',
      import: './index.js'
    }
  },
  files: ['*.js', '*.d.ts'],
  publishConfig: sourcePackage.publishConfig ?? { access: 'public' },
  dependencies: {
    zod: resolveCatalog('zod'),
    'zod-validation-error': resolveCatalog('zod-validation-error')
  }
}

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true })
}

fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(distPackage, null, 2) + '\n'
)
console.warn(`Prepared ${distPackage.name}@${distPackage.version} in dist/`)
