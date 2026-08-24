import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'

type ComponentManifestEntry = {
  component: string
  source: string
  storyFile: string
  title: string
  status: 'stable' | 'needs-tests'
  category: string
  capabilities: string[]
  testEligible: boolean
  limitations: string[]
  stories: Array<{
    exportName: string
    storyId: string
  }>
}

const websiteRoot = resolve(import.meta.dirname, '..')
const sourceRoot = join(websiteRoot, 'src')
const outputPath = join(
  websiteRoot,
  '.storybook/generated/component-manifest.json'
)

const capabilityRules: Array<[RegExp, string[]]> = [
  [/Button/, ['activation', 'keyboard-focus']],
  [/Carousel/, ['carousel-navigation', 'responsive-layout']],
  [/Dialog|TeamGrid/, ['dialog', 'focus-management', 'keyboard-dismissal']],
  [/FAQ/, ['disclosure', 'keyboard-activation']],
  [/Gallery/, ['responsive-layout', 'collection-layout']],
  [/CardArticleGallery/, ['filtering', 'pagination']],
  [/Hero|Grid|Layout|Section|Split|Bands/, ['responsive-layout']],
  [/Card/, ['linked-content']]
]

async function findStoryFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return findStoryFiles(path)
      return entry.name.endsWith('.stories.ts') ? [path] : []
    })
  )
  return paths.flat()
}

async function findVueFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return findVueFiles(path)
      return entry.name.endsWith('.vue') ? [path] : []
    })
  )
  return paths.flat()
}

function storyId(title: string, exportName: string): string {
  const sanitize = (value: string) =>
    value
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
  const storyName = exportName.replace(/([a-z0-9])([A-Z])/g, '$1-$2')

  return `${sanitize(title)}--${sanitize(storyName)}`
}

function capabilities(component: string): string[] {
  return [
    ...new Set(
      capabilityRules.flatMap(([pattern, values]) =>
        pattern.test(component) ? values : []
      )
    )
  ].sort()
}

async function manifestEntry(
  storyFile: string
): Promise<ComponentManifestEntry> {
  const contents = await readFile(storyFile, 'utf8')
  const title = [...contents.matchAll(/title:\s*'([^']+)'/g)]
    .map(([, value]) => value)
    .find((value) => value.startsWith('Website/'))
  const componentImport = contents.match(
    /import\s+([A-Z][A-Za-z0-9]*)\s+from\s+'(\.\/[^']+\.vue)'/
  )
  const exports = [...contents.matchAll(/^export const (\w+):/gm)].map(
    ([, exportName]) => exportName
  )

  if (!title || !componentImport || exports.length === 0) {
    throw new Error(`Unable to derive Storybook metadata from ${storyFile}`)
  }

  const [, component, componentPath] = componentImport
  const needsTests = contents.includes("'needs-tests'")
  const source = relative(
    websiteRoot,
    resolve(dirname(storyFile), componentPath)
  )

  return {
    component,
    source,
    storyFile: relative(websiteRoot, storyFile),
    title,
    status: needsTests ? 'needs-tests' : 'stable',
    category: title.split('/').slice(1, -1).join('/').toLowerCase(),
    capabilities: capabilities(component),
    testEligible: !needsTests,
    limitations: needsTests
      ? [
          'Excluded from browser tests because the Vitest importer fails before render.'
        ]
      : [],
    stories: exports.map((exportName) => ({
      exportName,
      storyId: storyId(title, exportName)
    }))
  }
}

const storyFiles = (await findStoryFiles(sourceRoot)).filter(
  (path) => !path.includes(`${join('src', 'storybook')}`)
)
const components = await Promise.all(storyFiles.sort().map(manifestEntry))
const manifest = {
  schemaVersion: 1,
  generatedFrom: 'apps/website/src/**/*.stories.ts',
  componentCount: components.length,
  storyCount: components.reduce(
    (count, component) => count + component.stories.length,
    0
  ),
  components
}
const documentedSources = new Set(components.map(({ source }) => source))
const vueComponents = (await findVueFiles(sourceRoot)).map((path) =>
  relative(websiteRoot, path)
)
const coverage = {
  schemaVersion: 1,
  componentCount: vueComponents.length,
  documentedComponentCount: documentedSources.size,
  missingStoryCount: vueComponents.length - documentedSources.size,
  missingStories: vueComponents
    .filter((source) => !documentedSources.has(source))
    .sort()
}
const coveragePath = join(
  websiteRoot,
  '.storybook/generated/story-coverage.json'
)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
await writeFile(coveragePath, `${JSON.stringify(coverage, null, 2)}\n`)

console.log(
  `Generated ${basename(outputPath)} with ${manifest.componentCount} components and ${manifest.storyCount} stories; ${coverage.missingStoryCount} Vue components remain uncatalogued.`
)
