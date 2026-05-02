import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(
  __dirname,
  '..',
  'packages',
  'workflow-validation'
)
const distDir = path.join(packageDir, 'dist')

const sourcePackage = JSON.parse(
  fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
)

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
    }
  },
  files: ['index.js', 'index.d.ts'],
  publishConfig: sourcePackage.publishConfig ?? { access: 'public' },
  peerDependencies: {
    zod: sourcePackage.dependencies.zod,
    'zod-validation-error': sourcePackage.dependencies['zod-validation-error']
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
