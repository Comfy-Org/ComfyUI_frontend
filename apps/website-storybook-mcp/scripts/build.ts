import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

type SourceManifest = {
  components: SourceComponent[]
}

type SourceComponent = {
  component: string
  source: string
  status: string
  category: string
  capabilities: string[]
  limitations: string[]
  provenance: {
    figma: string
    sourceOfTruth: string
  }
  agent: {
    importPath: string
    docsPath: string
    states: string[]
    hasInteractionTest: boolean
    hasResponsiveStories: boolean
  }
  stories: Array<{
    exportName: string
    storyId: string
  }>
}

const appRoot = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(appRoot, '../..')
const websiteRoot = resolve(repositoryRoot, 'apps/website')
const publicRoot = resolve(appRoot, 'public')
const sourceManifestPath = resolve(
  websiteRoot,
  '.storybook/generated/component-manifest.json'
)

const sourceManifest = JSON.parse(
  await readFile(sourceManifestPath, 'utf8')
) as SourceManifest

const components = Object.fromEntries(
  sourceManifest.components.map((component) => {
    const id =
      component.stories[0]?.storyId.split('--')[0] ?? component.component
    const summary = [
      `${component.status} ${component.category} component.`,
      component.capabilities.length > 0
        ? `Capabilities: ${component.capabilities.join(', ')}.`
        : '',
      component.agent.hasInteractionTest
        ? 'Includes interaction coverage.'
        : '',
      component.agent.hasResponsiveStories ? 'Includes responsive stories.' : ''
    ]
      .filter(Boolean)
      .join(' ')
    const documentation = [
      `# ${component.component}`,
      '',
      summary,
      '',
      `Import: \`${component.agent.importPath}\``,
      `Source: \`${component.provenance.sourceOfTruth}\``,
      `Figma: ${component.provenance.figma}`,
      `Storybook docs: ${component.agent.docsPath}`,
      '',
      `States: ${component.agent.states.join(', ')}`,
      ...(component.limitations.length > 0
        ? [
            '',
            'Limitations:',
            ...component.limitations.map((value) => `- ${value}`)
          ]
        : [])
    ].join('\n')

    return [
      id,
      {
        id,
        name: component.component,
        path: component.source,
        import: component.agent.importPath,
        summary,
        stories: component.stories.map((story) => ({
          id: story.storyId,
          name: story.exportName,
          summary: `${component.component} — ${story.exportName}`,
          snippet: `<${component.component} />`
        })),
        docs: {
          [`${id}--docs`]: {
            id: `${id}--docs`,
            name: 'Docs',
            title: component.component,
            path: component.agent.docsPath,
            summary,
            content: documentation
          }
        }
      }
    ]
  })
)

await rm(publicRoot, { recursive: true, force: true })
await cp(resolve(websiteRoot, 'dist/storybook'), publicRoot, {
  recursive: true
})

const manifestPath = resolve(publicRoot, 'manifests/components.json')
await mkdir(dirname(manifestPath), { recursive: true })
await writeFile(
  manifestPath,
  `${JSON.stringify({ v: 0, components }, null, 2)}\n`
)
