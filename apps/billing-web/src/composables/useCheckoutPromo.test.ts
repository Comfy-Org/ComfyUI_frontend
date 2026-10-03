import type { PreviewSubscribeResult } from '@comfyorg/account-core/billing'

import { useCheckoutPromo } from '@/composables/useCheckoutPromo'
import { previewOf } from '@/test/fakeBillingClient'

/** Mirrors `usePreviewSubscribe.quote()`: a newer quote supersedes the pending one. */
function supersedingRequote() {
  const pending: ((result: PreviewSubscribeResult) => void)[] = []
  const requote = vi.fn(
    (_code?: string) =>
      new Promise<PreviewSubscribeResult>((resolve) => {
        pending.at(-1)?.({ status: 'error', code: 'SUPERSEDED' })
        pending.push(resolve)
      })
  )
  const answerLatest = (result: PreviewSubscribeResult) =>
    pending.at(-1)?.(result)
  return { requote, answerLatest }
}

describe('useCheckoutPromo', () => {
  it('ignores a second Apply while the first code is still being priced', async () => {
    const { requote, answerLatest } = supersedingRequote()
    const promo = useCheckoutPromo({
      prefill: { promotionCode: 'LAUNCH20' },
      live: () => true,
      requote,
      memory: { recall: () => undefined, keep: () => {} }
    })

    const first = promo.apply()
    const second = promo.apply()
    answerLatest({
      status: 'ok',
      value: previewOf({ promotion_code: 'LAUNCH20' })
    })
    await Promise.all([first, second])

    expect(promo.entry.value).toEqual({ kind: 'applied', code: 'LAUNCH20' })
    expect(requote).toHaveBeenCalledOnce()
  })
})
