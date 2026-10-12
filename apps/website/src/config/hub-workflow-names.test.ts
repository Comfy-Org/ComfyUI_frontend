import { describe, expect, it } from 'vitest'

import { hubWorkflowName } from './hub-models'
import { workflowModels } from './workshop-workflow-content'

describe('hub-workflow-names.json', () => {
  it('lists every published workflow page (vitest -u regenerates it; comfy-router#46 copies it)', async () => {
    const names = workflowModels.map(({ slug }) => hubWorkflowName(slug)).sort()
    await expect(`${JSON.stringify(names, null, 2)}\n`).toMatchFileSnapshot(
      './hub-workflow-names.json'
    )
  })
})
