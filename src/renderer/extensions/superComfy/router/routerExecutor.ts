import { t } from '@/i18n'
import type { Executor } from '@/renderer/extensions/superComfy/engine/types'

export function createRouterExecutor(): Executor {
  return {
    concurrency: 4,
    begin: () => ({
      run: () =>
        Promise.resolve({ ok: false, message: t('superComfy.node.noOutput') }),
      dispose: () => Promise.resolve()
    })
  }
}
