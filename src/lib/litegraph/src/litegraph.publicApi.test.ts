import { describe, expect, it } from 'vitest'

import * as litegraph from './litegraph'

describe('litegraph public API', () => {
  it('does not export internal slot-link helpers', () => {
    for (const helper of [
      'inputHasLink',
      'outputHasLinks',
      'outputLinkIds',
      'inputLink',
      'outputLinks'
    ]) {
      expect(litegraph).not.toHaveProperty(helper)
    }
  })
})
