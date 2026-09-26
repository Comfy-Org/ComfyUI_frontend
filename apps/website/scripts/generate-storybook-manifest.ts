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
  provenance: {
    implementation: 'shipped-website'
    figma: string
    sourceOfTruth: string
  }
  agent: {
    importPath: string
    storybookPath: string
    docsPath: string
    states: string[]
    hasInteractionTest: boolean
    hasResponsiveStories: boolean
    compositionSafe: boolean
  }
  stories: Array<{
    exportName: string
    storyId: string
  }>
}

type CoverageDisposition =
  | 'page-local'
  | 'template-local'
  | 'compound-part'
  | 'icon'
  | 'integration'
  | 'reusable-candidate'

const figmaUrl =
  'https://www.figma.com/design/11vkE4FAn4plEYpawd57zS/Comfy----Website-Design?node-id=1-9'

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

function classifyUncatalogued(source: string): {
  disposition: CoverageDisposition
  reason: string
} {
  if (source.includes('/icons/')) {
    return {
      disposition: 'icon',
      reason:
        'Decorative implementation asset; catalog through its owning control.'
    }
  }
  if (/Hubspot|Embed|Arcade/.test(source)) {
    return {
      disposition: 'integration',
      reason:
        'External integration boundary; verify in its owning page or integration test.'
    }
  }
  if (source.includes('/templates/')) {
    return {
      disposition: 'template-local',
      reason:
        'Template-specific section; compose from cataloged blocks before promoting.'
    }
  }
  if (
    source.includes('/ui/') &&
    /(Content|Description|Footer|Header|Item|Link|List|Overlay|Title|Trigger|Viewport|Close)\.vue$/.test(
      source
    )
  ) {
    return {
      disposition: 'compound-part',
      reason:
        'Compound component part documented through its cataloged root composition.'
    }
  }
  if (source.includes('/common/') || source.includes('/ui/')) {
    return {
      disposition: 'reusable-candidate',
      reason:
        'Shared location indicates reuse potential; requires an explicit contract before promotion.'
    }
  }
  return {
    disposition: 'page-local',
    reason:
      'Feature or page-specific section; not an independent design-system primitive.'
  }
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
    provenance: {
      implementation: 'shipped-website',
      figma: figmaUrl,
      sourceOfTruth: source
    },
    agent: {
      importPath: `@/${source.replace(/^src\//, '').replace(/\.vue$/, '')}`,
      storybookPath: `/?path=/story/${storyId(title, exports[0])}`,
      docsPath: `/?path=/docs/${storyId(title, 'docs').replace(/--docs$/, '--docs')}`,
      states: exports,
      hasInteractionTest: /\bplay\s*:/.test(contents),
      hasResponsiveStories: exports.some((name) =>
        /Mobile|Desktop|Tablet/.test(name)
      ),
      compositionSafe: !needsTests
    },
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
  schemaVersion: 2,
  generatedFrom: 'apps/website/src/**/*.stories.ts',
  figma: figmaUrl,
  usagePolicy: {
    evidenceOrder: [
      'shipped website implementation',
      'component story and interaction contract',
      'Figma provenance',
      'page recipe'
    ],
    unknownPattern: 'Treat as a gap; do not invent a local substitute.'
  },
  componentCount: components.length,
  storyCount: components.reduce(
    (count, component) => count + component.stories.length,
    0
  ),
  components,
  recipes: [
    {
      name: 'Product landing',
      storyId: 'website-recipes-page-patterns--product-landing',
      requiredBlocks: [
        'HeroSplit01',
        'FeatureRows01',
        'StepsGrid01',
        'CtaCenter01'
      ]
    },
    {
      name: 'Article gallery',
      storyId: 'website-recipes-page-patterns--article-gallery',
      requiredBlocks: ['HeroCentered01', 'CardArticleGallery01', 'CtaCenter01']
    },
    {
      name: 'Pricing',
      storyId: 'website-recipes-page-patterns--pricing',
      requiredBlocks: ['PricingSection', 'CtaCenter01']
    },
    {
      name: 'Event',
      storyId: 'website-recipes-page-patterns--event',
      requiredBlocks: ['HeroCentered01', 'CardArticleGallery01']
    },
    {
      name: 'Model launch',
      storyId: 'website-recipes-page-patterns--model-launch',
      requiredBlocks: [
        'HeroSplit01',
        'StepsGrid01',
        'FAQSplit01',
        'CtaCenter01'
      ]
    }
  ]
}
const documentedSources = new Set(components.map(({ source }) => source))
const vueComponents = (await findVueFiles(sourceRoot)).map((path) =>
  relative(websiteRoot, path)
)
const uncatalogued = vueComponents
  .filter((source) => !documentedSources.has(source))
  .sort()
  .map((source) => ({ source, ...classifyUncatalogued(source) }))
const dispositionCounts = Object.fromEntries(
  [...new Set(uncatalogued.map(({ disposition }) => disposition))]
    .sort()
    .map((disposition) => [
      disposition,
      uncatalogued.filter((entry) => entry.disposition === disposition).length
    ])
)
const coverage = {
  schemaVersion: 2,
  componentCount: vueComponents.length,
  documentedComponentCount: documentedSources.size,
  missingStoryCount: vueComponents.length - documentedSources.size,
  dispositionCounts,
  classifications: uncatalogued,
  missingStories: uncatalogued.map(({ source }) => source)
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
