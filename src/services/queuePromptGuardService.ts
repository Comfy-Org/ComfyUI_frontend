import { t } from '@/i18n'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { NodeExecutionId } from '@/types/nodeIdentification'

export interface QueuePromptGuardContext {
  readonly rootGraph: LGraph
  readonly queueNodeIds?: readonly NodeExecutionId[]
}

export type QueuePromptGuard = (
  context: QueuePromptGuardContext
) => boolean | Promise<boolean>

const guards = new Map<string, QueuePromptGuard>()

async function runGuard(
  guard: QueuePromptGuard,
  context: QueuePromptGuardContext
): Promise<'allowed' | 'blocked' | 'failed'> {
  try {
    return (await guard(context)) === false ? 'blocked' : 'allowed'
  } catch (error) {
    console.error('Queue prompt guard failed; blocking prompt', error)
    return 'failed'
  }
}

export function registerQueuePromptGuard(
  id: string,
  guard: QueuePromptGuard
): () => void {
  guards.set(id, guard)
  return () => {
    if (guards.get(id) === guard) guards.delete(id)
  }
}

export async function runQueuePromptGuards(
  context: QueuePromptGuardContext
): Promise<boolean> {
  const results = await Promise.all(
    [...guards.values()].map((guard) => runGuard(guard, context))
  )
  if (results.includes('failed')) {
    useToastStore().add({
      severity: 'error',
      summary: t('toastMessages.failedToQueue')
    })
  }
  return results.every((result) => result === 'allowed')
}
