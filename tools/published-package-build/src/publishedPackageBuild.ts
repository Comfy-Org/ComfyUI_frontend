import { readFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import type { PluginOption, UserConfig } from 'vite'
import dts from 'vite-plugin-dts'

type ExportTarget = string | { import: string }

type SourceTarget = string | { default: string }

interface PublishedManifest {
  exports: Record<string, SourceTarget>
  publishConfig: { exports: Record<string, ExportTarget> }
}

const sourcePath = (target: SourceTarget) =>
  typeof target === 'string' ? target : target.default

const BUILT_ENTRY = /^\.\/dist\/(.+)\.js$/

const builtEntryName = (target: ExportTarget) =>
  typeof target === 'string' ? undefined : target.import.match(BUILT_ENTRY)?.[1]

function readEntries(packageDir: string): Record<string, string> {
  const manifest: PublishedManifest = JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8')
  )
  return Object.fromEntries(
    Object.entries(manifest.publishConfig.exports).flatMap(([key, target]) => {
      const name = builtEntryName(target)
      return name
        ? [[name, join(packageDir, sourcePath(manifest.exports[key]))]]
        : []
    })
  )
}

const SPECIFIER = /(from |import\()(['"])((?:\.{1,2}|#)\/[^'"]*)\2/g

const EMITTED_EXTENSION = /\.(js|json)$/

const toPosix = (path: string) => path.split(sep).join(posix.sep)

function resolveImportsSpecifier(
  specifier: string,
  declarationDir: string,
  outDir: string
): string {
  const path = toPosix(relative(declarationDir, join(outDir, specifier)))
  return path.startsWith('.') ? path : `./${path}`
}

function rewriteSpecifier(
  specifier: string,
  declarationDir: string,
  outDir: string
): string {
  const relativeSpecifier = specifier.startsWith('#/')
    ? resolveImportsSpecifier(specifier.slice(2), declarationDir, outDir)
    : specifier
  return EMITTED_EXTENSION.test(relativeSpecifier)
    ? relativeSpecifier
    : `${relativeSpecifier.replace(/\.vue$/, '')}.js`
}

/**
 * Library build for a published workspace package: one ES entry per published
 * export, declarations whose `#/` and extensionless relative specifiers point
 * at the emitted `.js`, so `nodenext` consumers resolve them.
 */
export function definePublishedPackageConfig({
  packageDir,
  external,
  plugins = [],
  cleanVueFileName = false
}: {
  packageDir: string
  external: (string | RegExp)[]
  plugins?: PluginOption[]
  cleanVueFileName?: boolean
}): UserConfig {
  const outDir = join(packageDir, 'dist')
  return {
    build: {
      lib: { entry: readEntries(packageDir), formats: ['es'] },
      outDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: {
        external,
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'shared/[name]-[hash].js'
        }
      }
    },
    plugins: [
      ...plugins,
      dts({
        tsconfigPath: join(packageDir, 'tsconfig.build.json'),
        cleanVueFileName,
        beforeWriteFile: (filePath, content) => ({
          content: content.replace(
            SPECIFIER,
            (_match, prefix: string, quote: string, specifier: string) =>
              `${prefix}${quote}${rewriteSpecifier(specifier, dirname(filePath), outDir)}${quote}`
          )
        })
      })
    ]
  }
}
