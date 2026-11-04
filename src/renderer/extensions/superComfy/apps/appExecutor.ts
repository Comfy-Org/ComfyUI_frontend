import { t } from '@/i18n'
import type { Executor } from '@/renderer/extensions/superComfy/engine/types'

export function createAppExecutor(): Executor {
  return {
    concurrency: 4,
    begin: () => ({
      run: () =>
        Promise.resolve({
          ok: false,
          message: t('superComfy.app.prepareFailed')
        }),
      dispose: () => Promise.resolve()
    })
  }
}
