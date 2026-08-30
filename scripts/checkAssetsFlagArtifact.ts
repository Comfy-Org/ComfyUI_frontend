import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

function javascriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return javascriptFiles(path)
    return extname(entry.name) === '.js' ? [path] : []
  })
}

function assetsEnabledGetter(chunks: ReadonlyArray<string>): string {
  const getters = chunks.flatMap(
    (chunk) => chunk.match(/get assetsEnabled\(\)\s*\{[\s\S]*?\n\s*\}/g) ?? []
  )

  if (getters.length !== 1) {
    throw new Error(
      `Expected one assetsEnabled getter in the build, found ${getters.length}`
    )
  }

  return getters[0]
}

export function assertAssetsDefaultDisabled(
  chunks: ReadonlyArray<string>
): void {
  const getter = assetsEnabledGetter(chunks)
  if (
    !/resolveFlag\(["']assets["'],\s*(?:void 0|undefined),\s*false\)/.test(
      getter
    )
  ) {
    throw new Error(`Built Assets flag does not default off:\n${getter.trim()}`)
  }
}

export function checkAssetsFlagArtifact(directory = 'dist'): void {
  assertAssetsDefaultDisabled(
    javascriptFiles(directory).map((path) => readFileSync(path, 'utf8'))
  )
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkAssetsFlagArtifact()
}
