import { describe, expect, it } from 'vitest'

import {
  componentImport,
  portablePath,
  storyId,
  storyTags
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
