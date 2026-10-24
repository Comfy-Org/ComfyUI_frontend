import { describe, expect, it } from 'vitest'

import {
  componentImport,
  portablePath,
  storyId,
  storyTags,
  showcaseComponentImports
} from './storybook-metadata'

describe('Storybook manifest metadata', () => {
  it('uses the declared component instead of the first Vue import', () => {
    expect(
      componentImport(`
        import WatchAuthorCard from './WatchAuthorCard.vue'
        import WatchPageLayout from './WatchPageLayout.vue'
        const meta = { component: WatchPageLayout }
        export default meta
      `)
    ).toEqual({
      component: 'WatchPageLayout',
      componentPath: './WatchPageLayout.vue'
    })
  })

  it('ignores nested and unrelated component properties', () => {
    expect(
      componentImport(`
      import Badge from './Badge.vue'
      const usage = 'Usage'
      const meta = { component: Badge, parameters: { docs: { description: { component: usage } } } } satisfies Meta
      const unrelated = { component: usage }
      export default meta
    `)
    ).toEqual({ component: 'Badge', componentPath: './Badge.vue' })
  })

  it('records explicitly declared showcase subcomponents', () => {
    expect(
      showcaseComponentImports(`
      import EditorSwitch from './EditorSwitch.vue'
      import EditorAlert from './EditorAlert.vue'
      export default { parameters: { catalog: { components: { EditorSwitch, Alert: EditorAlert } } } }
    `)
    ).toEqual([
      { component: 'EditorSwitch', componentPath: './EditorSwitch.vue' },
      { component: 'EditorAlert', componentPath: './EditorAlert.vue' }
    ])
  })

  it.for([
    ['Mp4Only', 'mp-4-only'],
    ['HTMLParser', 'html-parser'],
    ['WithControls', 'with-controls']
  ])('matches the catalog ID for %s', ([exportName, suffix]) => {
    expect(storyId('Website/Common/SiteVideo', exportName)).toBe(
      `website-common-sitevideo--${suffix}`
    )
  })

  it('rejects metadata without an imported Vue component', () => {
    expect(componentImport('const meta = { title: "Recipe" }')).toBeUndefined()
  })
})

describe('catalog certification tags', () => {
  it('reads only the exported metadata tags', () => {
    expect(
      storyTags(`
      const unrelated = { tags: ['needs-tests'] }
      const meta = { tags: ['autodocs', 'stable'], args: { value: "'needs-tests'" } } satisfies Meta
      export default meta
    `)
    ).toEqual(['autodocs', 'stable'])
    expect(storyTags(`export default { args: { value: "'stable'" } }`)).toEqual(
      []
    )
  })

  it('normalizes Windows and POSIX source paths identically', () => {
    expect(portablePath(String.raw`src\components\SiteVideo.vue`)).toBe(
      'src/components/SiteVideo.vue'
    )
    expect(portablePath('src/components/SiteVideo.vue')).toBe(
      'src/components/SiteVideo.vue'
    )
  })
})
