import { describe, expect, it } from 'vitest'

import { hubAppName } from './hub-models'
import { appModels } from './workshop-app-content'

describe('hub-app-names.json', () => {
  it('lists every published app page (vitest -u regenerates it)', async () => {
    const names = appModels.map(({ slug }) => hubAppName(slug)).sort()
    expect(names).not.toHaveLength(0)
    await expect(`${JSON.stringify(names, null, 2)}\n`).toMatchFileSnapshot(
      './hub-app-names.json'
    )
  })
})
