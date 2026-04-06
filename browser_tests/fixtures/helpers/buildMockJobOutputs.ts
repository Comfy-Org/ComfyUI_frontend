import type { JobDetailResponse } from '@comfyorg/ingest-types'

import type { TaskOutput } from '../../../src/schemas/apiSchema'

import type {
  GeneratedJobFixture,
  GeneratedOutputFixture
} from './assetScenarioTypes'

export function buildMockJobOutputs(
  job: GeneratedJobFixture,
  outputs: GeneratedOutputFixture[]
): NonNullable<JobDetailResponse['outputs']> {
  const nodeId = job.nodeId ?? '5'

  const taskOutput = {
    [nodeId]: {
      [outputs[0].mediaType ?? 'images']: outputs.map((output) => ({
        filename: output.filename,
        subfolder: output.subfolder ?? '',
        type: output.type ?? 'output',
        display_name: output.displayName
      }))
    }
  } satisfies TaskOutput

  return taskOutput
}
