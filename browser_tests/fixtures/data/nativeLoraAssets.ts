import type { Asset } from '@comfyorg/ingest-types'

import { STABLE_LORA } from '@e2e/fixtures/data/assetFixtures'

export const NATIVE_LORA_ASSETS: Asset[] = ['A', 'B', 'C'].map(
  (name, index) => ({
    ...STABLE_LORA,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: `${name}.safetensors`,
    user_metadata: { filename: `native-lora-e2e/${name}.safetensors` }
  })
)
