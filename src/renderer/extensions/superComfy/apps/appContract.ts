import type { AppContract } from '@/renderer/extensions/superComfy/engine/documentSchema'

export type AppContractResolution =
  | { ok: true; contract: AppContract; title: string }
  | {
      ok: false
      reason: 'notFound' | 'noOutputs' | 'missingNodes' | 'prepareFailed'
      detail?: string
    }

export function resolveAppContract(
  _path: string
): Promise<AppContractResolution> {
  return Promise.resolve({ ok: false, reason: 'prepareFailed' })
}
