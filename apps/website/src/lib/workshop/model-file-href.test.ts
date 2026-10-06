import { describe, expect, it } from 'vitest'

import { modelFileHref } from './model-file-href'

describe('modelFileHref', () => {
  it.for([
    { workshopInBuild: true, href: '/hub/models/local/ae/' },
    { workshopInBuild: false, href: '/p/supported-models/ae/' }
  ])(
    'puts the file page at $href when the Hub in the build is $workshopInBuild',
    ({ workshopInBuild, href }) => {
      expect(modelFileHref('ae', workshopInBuild)).toBe(href)
    }
  )
})
