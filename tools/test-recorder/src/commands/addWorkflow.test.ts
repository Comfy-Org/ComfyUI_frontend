import { describe, expect, it, vi } from 'vitest'

import { WORKFLOW_ASSET_EXPLANATION } from '../workflows/add'
import { runAddWorkflow } from './addWorkflow'

const { addWorkflow, findProjectRoot } = vi.hoisted(() => ({
  addWorkflow: vi.fn(() => ({
    destRelPath: 'browser_tests/assets/example.json'
  })),
  findProjectRoot: vi.fn(() => '/project')
}))

vi.mock('../recorder/runner', () => ({ findProjectRoot }))
vi.mock('../workflows/add', () => ({
  addWorkflow,
  WORKFLOW_ASSET_EXPLANATION:
    'This workflow is copied into shared test assets so automated runs on other machines can use it. Personal files that are not added this way will not work there.'
}))

describe('runAddWorkflow', () => {
  it('explains why the workflow is copied into shared test assets', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    runAddWorkflow('/tmp/example.json')

    expect(log).toHaveBeenNthCalledWith(1, 'browser_tests/assets/example.json')
    expect(log).toHaveBeenNthCalledWith(2, WORKFLOW_ASSET_EXPLANATION)
  })
})
