import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  WorkflowWorkshopModelDetail,
  WorkshopModelDetail
} from '@/config/models-catalogue'
import {
  getWorkshopPageDetail,
  workshopPages
} from '@/config/workshop-page-content'
import { pagePaths } from './page-paths'

const details = workshopPages
  .map((page) => getWorkshopPageDetail(page.slug))
  .filter((detail): detail is WorkshopModelDetail => detail !== undefined)

function firstDetail<Detail extends WorkshopModelDetail>(
  matches: (detail: WorkshopModelDetail) => detail is Detail
): Detail
function firstDetail(
  matches: (detail: WorkshopModelDetail) => boolean
): WorkshopModelDetail
function firstDetail(matches: (detail: WorkshopModelDetail) => boolean) {
  const detail = details.find(matches)
  if (!detail) throw new Error('The catalogue has no such page')
  return detail
}

beforeEach(() => {
  vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
})

describe('pagePaths', () => {
  it('runs a complete model here and offers its API from its contract', () => {
    const model = firstDetail(
      (detail) =>
        detail.routerId !== undefined &&
        !detail.incompleteReason &&
        detail.execution !== undefined
    )

    expect(pagePaths(model)).toEqual({ run: true, api: true })
    expect(pagePaths({ ...model, execution: undefined })).toEqual({
      run: false,
      api: false
    })
  })

  it('never runs a model that is not complete', () => {
    const model = firstDetail((detail) => detail.routerId !== undefined)

    expect(
      pagePaths({ ...model, incompleteReason: 'missing-input-schema' }).run
    ).toBe(false)
  })

  it('runs a workflow here, API included, only when it runs on Cloud', () => {
    const workflow = firstDetail(
      (detail): detail is WorkflowWorkshopModelDetail =>
        detail.routerId === undefined &&
        detail.type === 'CLOUD' &&
        !detail.incompleteReason &&
        !!detail.workflow.cloud
    )

    expect(pagePaths(workflow)).toEqual({ run: true, api: true })
    expect(
      pagePaths({
        ...workflow,
        workflow: { ...workflow.workflow, cloud: undefined }
      })
    ).toEqual({ run: false, api: false })
  })
})
