import type { JobDetailResponse } from '@comfyorg/ingest-types'

import type { TaskOutput } from '@/schemas/apiSchema'

import type {
  GeneratedJobFixture,
  GeneratedOutputFixture
} from '@e2e/fixtures/helpers/assetScenarioTypes'

export function buildMockJobOutputs(
  job: GeneratedJobFixture,
  outputs: GeneratedOutputFixture[]
): NonNullable<JobDetailResponse['outputs']> {
  const nodeId = job.nodeId ?? '5'
  const nodeOutputs: Pick<TaskOutput[string], 'audio' | 'images' | 'video'> = {}

  for (const output of outputs) {
    const mediaType = output.mediaType ?? 'images'

    nodeOutputs[mediaType] = [
      ...(nodeOutputs[mediaType] ?? []),
      {
        filename: output.filename,
        subfolder: output.subfolder ?? '',
        type: output.type ?? 'output',
        display_name: output.displayName
      }
    ]
  }

  const taskOutput = { [nodeId]: nodeOutputs } satisfies TaskOutput

  return taskOutput
}
