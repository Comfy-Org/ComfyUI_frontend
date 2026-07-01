import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ObjectInfo } from '@e2e/fixtures/customNode/objectInfoValidator'
import {
  expectedNodesPresent,
  preValidate
} from '@e2e/fixtures/customNode/objectInfoValidator'

const objectInfo: ObjectInfo = {
  KSampler: { input: { required: { model: {}, seed: {} } } }
}

test.describe('objectInfoValidator', () => {
  test('expectedNodesPresent splits present from missing', () => {
    const { present, missing } = expectedNodesPresent(objectInfo, [
      'KSampler',
      'Missing (rgthree)'
    ])
    expect(present).toEqual(['KSampler'])
    expect(missing).toEqual(['Missing (rgthree)'])
  })

  test('preValidate returns MISSING_NODE for an unregistered class', () => {
    const failure = preValidate(objectInfo, [
      { id: '1', classType: 'Ghost', inputs: {} }
    ])
    expect(failure?.outcome).toBe('MISSING_NODE')
  })

  test('preValidate returns VALIDATION_FAIL naming the missing required input', () => {
    const failure = preValidate(objectInfo, [
      { id: '3', classType: 'KSampler', inputs: { model: 0 } }
    ])
    expect(failure?.outcome).toBe('VALIDATION_FAIL')
    expect(failure?.message).toContain('missing required input "seed"')
  })

  test('preValidate passes when every required input is present', () => {
    expect(
      preValidate(objectInfo, [
        { id: '3', classType: 'KSampler', inputs: { model: 0, seed: 1 } }
      ])
    ).toBeNull()
  })
})
