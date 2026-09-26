import { beforeEach, describe, expect, it } from 'vitest'

import { hashPath } from '../base/hashUtil'
import { migrateV1toV2 } from './migrateV1toV2'

describe('migrateV1toV2 malformed V2 payload recovery', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('recovers valid V1 data when the matching V2 payload is malformed', () => {
    const path = 'workflows/recover-malformed-v2.json'
    const draftKey = hashPath(path)
    const legacyData = '{"legacy":true}'

    localStorage.setItem(
      'Comfy.Workflow.DraftIndex.v2:personal',
      JSON.stringify({
        v: 2,
        updatedAt: 3000,
        order: [draftKey],
        entries: {
          [draftKey]: {
            path,
            name: 'recover-malformed-v2',
            isTemporary: true,
            updatedAt: 3000
          }
        }
      })
    )
    localStorage.setItem(
      `Comfy.Workflow.Draft.v2:personal:${draftKey}`,
      JSON.stringify({})
    )
    localStorage.setItem(
      'Comfy.Workflow.Drafts',
      JSON.stringify({
        [path]: {
          data: legacyData,
          updatedAt: 1000,
          name: 'recover-malformed-v2',
          isTemporary: true
        }
      })
    )
    localStorage.setItem('Comfy.Workflow.DraftOrder', JSON.stringify([path]))

    expect(migrateV1toV2('personal')).toBe(1)

    const recoveredPayload = JSON.parse(
      localStorage.getItem(`Comfy.Workflow.Draft.v2:personal:${draftKey}`) ??
        'null'
    )
    expect(recoveredPayload).toEqual({ data: legacyData, updatedAt: 1000 })
  })
})
