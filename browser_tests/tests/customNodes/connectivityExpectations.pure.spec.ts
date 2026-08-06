import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { connectivityExpectationsFor } from '@e2e/fixtures/customNode/connectivityExpectations'

test.describe('connectivityExpectationsFor', () => {
  test('limits zero-pair S5 relief to artifact-proven pack node counts', () => {
    expect(
      connectivityExpectationsFor('cloud').zeroPairDragExpectedNodeCounts
    ).toEqual({
      'comfyui-impact-subpack': 1,
      'comfyui-string-converter': 2
    })
    expect(
      connectivityExpectationsFor('cloud').zeroPairDragExpectedNodeCounts
        .bfsnodes
    ).toBeUndefined()
    expect(
      connectivityExpectationsFor('core').zeroPairDragExpectedNodeCounts
    ).toEqual({})
  })

  test('keeps the legacy Core expectations scoped to Core', () => {
    const core = connectivityExpectationsFor('core')

    expect(core.connectRejected).toEqual([
      'AddTextPrefix.texts -> MathExpression|pysssss.expression'
    ])
    expect(core.conditionalSlotContractMismatch).toHaveLength(2)
    expect(core.deterministicSlotContractMismatch).toEqual([])
    expect(core.roundtripLost).toHaveLength(3)
  })

  test('keeps the artifact-proven Cloud expectations scoped to Cloud', () => {
    const cloud = connectivityExpectationsFor('cloud')

    expect(cloud.connectRejected).toHaveLength(3)
    expect(cloud.conditionalSlotContractMismatch).toEqual([])
    expect(cloud.deterministicSlotContractMismatch).toHaveLength(17)
    expect(cloud.roundtripLost).toHaveLength(13)
    expect(cloud.connectRejected).not.toContain(
      'AddTextPrefix.texts -> MathExpression|pysssss.expression'
    )
  })

  test('covers only the missing dynamic outputs from 5 through 20', () => {
    const dynamic = connectivityExpectationsFor(
      'cloud'
    ).deterministicSlotContractMismatch.filter((key) =>
      key.startsWith('FL_VideoBatchSplitter.')
    )

    expect(dynamic).toHaveLength(16)
    expect(dynamic[0]).toContain('batch_5')
    expect(dynamic.at(-1)).toContain('batch_20')
  })
})
