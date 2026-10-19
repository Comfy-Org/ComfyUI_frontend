import { describe, expect, it } from 'vitest'

import { componentImport, storyId } from './storybook-metadata'

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
