import { ref } from 'vue'
import type { Ref } from 'vue'

import { t } from '@/i18n'
import type {
  GenerateContract,
  Modality
} from '@/renderer/extensions/superComfy/engine/documentSchema'

export interface RouterCatalogEntry {
  id: string
  label: string
  provider: string
}

export type RouterCatalogState =
  | {
      status: 'loading'
      done: number
      total: number
      models: RouterCatalogEntry[]
    }
  | { status: 'ready'; models: RouterCatalogEntry[]; unsupported: number }
  | { status: 'refused'; detail: string }
  | { status: 'failed'; message: string }

export type RouterAccess =
  | { status: 'ok' }
  | { status: 'refused'; detail: string }
  | { status: 'unreachable'; message: string }

export function useRouterCatalog(
  _modality: Modality
): Readonly<Ref<RouterCatalogState>> {
  return ref<RouterCatalogState>({
    status: 'ready',
    models: [],
    unsupported: 0
  })
}

export function resolveModelContract(
  _modelId: string,
  _modality: Modality
): Promise<
  | { ok: true; contract: GenerateContract; label: string }
  | { ok: false; message: string }
> {
  return Promise.resolve({
    ok: false,
    message: t('superComfy.model.loadFailed')
  })
}

export function probeRouterAccess(): Promise<RouterAccess> {
  return Promise.resolve({
    status: 'unreachable',
    message: t('superComfy.model.loadFailed')
  })
}
