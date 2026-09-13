import { beforeEach, describe, expect, it } from 'vitest'

import { hashPath } from '../base/hashUtil'
import { migrateV1toV2 } from './migrateV1toV2'

describe('migrateV1toV2 collision cleanup safety', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('keeps legacy data when a V2 draft key maps to a different path', () => {
    const legacyPath = 'workflows/collide.json'
    const draftKey = hashPath(legacyPath)
    const legacyDrafts = JSON.stringify({
      [legacyPath]: {
        data: '{"legacy":true}',
        updatedAt: 1000,
        name: 'collide',
        isTemporary: true
      }
    })
    const legacyOrder = JSON.stringify([legacyPath])

    localStorage.setItem(
      'Comfy.Workflow.DraftIndex.v2:personal',
      JSON.stringify({
        v: 2,
        updatedAt: 3000,
        order: [draftKey],
        entries: {
          [draftKey]: {
            path: 'workflows/different.json',
            name: 'different',
            isTemporary: true,
            updatedAt: 3000
          }
        }
      })
    )
    localStorage.setItem('Comfy.Workflow.Drafts', legacyDrafts)
    localStorage.setItem('Comfy.Workflow.DraftOrder', legacyOrder)

    migrateV1toV2('personal')

    expect(localStorage.getItem('Comfy.Workflow.Drafts')).toBe(legacyDrafts)
    expect(localStorage.getItem('Comfy.Workflow.DraftOrder')).toBe(legacyOrder)
  })
})
