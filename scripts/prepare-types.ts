import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { z } from 'zod'

const mainPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  repository: z.string(),
  homepage: z.string(),
  license: z.string(),
  dependencies: z.object({ vue: z.string(), zod: z.string() })
})

const versionedPackageSchema = z.object({ version: z.string() })

const require = createRequire(import.meta.url)
const mainPackage = mainPackageSchema.parse(
  JSON.parse(fs.readFileSync('./package.json', 'utf8'))
)
const desktopBridgeTypesPackage = versionedPackageSchema.parse(
  JSON.parse(
    fs.readFileSync(
      require.resolve('@comfyorg/comfyui-desktop-bridge-types/package.json'),
      'utf8'
    )
  )
)

const typesPackage = {
  name: `${mainPackage.name}-types`,
  version: mainPackage.version,
  types: './index.d.ts',
  files: ['index.d.ts'],
  publishConfig: {
    access: 'public'
  },
  repository: mainPackage.repository,
  homepage: mainPackage.homepage,
  description: `TypeScript definitions for ${mainPackage.name}`,
  license: mainPackage.license,
  dependencies: {
    '@comfyorg/comfyui-desktop-bridge-types': desktopBridgeTypesPackage.version
  },
  peerDependencies: {
    vue: mainPackage.dependencies.vue,
    zod: mainPackage.dependencies.zod
  }
}

const distDir = './dist'
fs.mkdirSync(distDir, { recursive: true })
fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(typesPackage, null, 2)
)
