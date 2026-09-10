import { describe, expect, it } from 'vitest'

import labelsJson from '../data/workshop-thumbnail-labels.json'
import type { WorkshopModel } from './models-catalogue'
import { routerWorkshopModels } from './workshop-browse-content'
import { labelSharedThumbnails } from './workshop-thumbnail-labels'

function model(id: string, url?: string): WorkshopModel {
  return {
    routerId: id,
    slug: id.replace('/', '--'),
    href: `/models/${id.replace('/', '--')}/`,
    name: id,
    workflowCount: 0,
    capabilities: [],
    runs: 0,
    ...(url ? { thumbnail: { kind: 'image', url } as const } : {})
  }
}

describe('shared thumbnail labels', () => {
  it('adds authored labels only when different models share the same artwork', () => {
    const models = [
      model('test/v1', 'shared.png'),
      model('test/turbo', 'shared.png'),
      model('test/unique', 'unique.png'),
      model('test/missing'),
      model('test/unlabelled', 'shared.png')
    ]
    const result = labelSharedThumbnails(models, {
      'test/v1': 'V1',
      'test/turbo': 'Turbo',
      'test/unique': 'V2',
      'test/missing': 'Pro'
    })
    expect(result.map((entry) => entry.thumbnailLabel)).toEqual([
      'V1',
      'Turbo',
      undefined,
      undefined,
      undefined
    ])
    expect(result.map(({ name, href }) => ({ name, href }))).toEqual(
      models.map(({ name, href }) => ({ name, href }))
    )
    expect(models.every((entry) => !entry.thumbnailLabel)).toBe(true)
    expect(
      result.filter((entry) => entry.routerId === 'test/turbo')[0]
        .thumbnailLabel
    ).toBe('Turbo')
  })

  it('does not mistake repeated cards for different versions', () => {
    const card = model('test/v1', 'shared.png')
    expect(
      labelSharedThumbnails([card, card], { 'test/v1': 'V1' }).map(
        (entry) => entry.thumbnailLabel
      )
    ).toEqual([undefined, undefined])
  })

  it('removes the need for a label when a model gets its own artwork', () => {
    expect(
      labelSharedThumbnails(
        [model('test/v1', 'v1.png'), model('test/turbo', 'turbo.png')],
        { 'test/v1': 'V1', 'test/turbo': 'Turbo' }
      ).map((entry) => entry.thumbnailLabel)
    ).toEqual([undefined, undefined])
  })

  it('gives every currently shared thumbnail a short, distinct label', () => {
    const groups = new Map<string, WorkshopModel[]>()
    for (const entry of routerWorkshopModels) {
      if (!entry.thumbnail) continue
      const key = `${entry.thumbnail.kind}:${entry.thumbnail.url}`
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }
    for (const group of groups.values()) {
      if (group.length === 1) {
        expect(group[0].thumbnailLabel).toBeUndefined()
        continue
      }
      for (const entry of group) {
        expect(entry.thumbnailLabel).toMatch(/^.{1,12}$/)
      }
      expect(
        new Set(group.map((entry) => entry.thumbnailLabel?.toLowerCase())).size
      ).toBe(group.length)
    }
    for (const id of Object.keys(labelsJson)) {
      expect(routerWorkshopModels.map((entry) => entry.routerId)).toContain(id)
    }
  })
})
