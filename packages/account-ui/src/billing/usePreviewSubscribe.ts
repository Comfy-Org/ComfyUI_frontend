import type {
  PreviewSubscribeInput,
  PreviewSubscribeResult,
  SubscriptionCommandFailure,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import { ref, shallowReadonly } from 'vue'
import type { Ref } from 'vue'

import type { BillingClient } from './billingClient'
import { useBillingClient } from './billingClient'

export interface SubscriptionQuoteOptions {
  readonly client?: Pick<BillingClient, 'commands'>
}

export interface SubscriptionQuote {
  /** The latest quote the server returned; money stays in its fields, unformatted. */
  readonly preview: Readonly<Ref<SubscriptionPreview | undefined>>
  readonly loading: Readonly<Ref<boolean>>
  /**
   * The last quote's failure. A scope change is not surfaced as one: it drops
   * the quote, which was priced for a workspace the host has left.
   */
  readonly failure: Readonly<Ref<SubscriptionCommandFailure | undefined>>
  /**
   * Quotes a plan change. A newer call abandons the one before it, so a slow
   * answer for a plan the user has moved off never lands on screen.
   */
  readonly quote: (
    input: PreviewSubscribeInput
  ) => Promise<PreviewSubscribeResult>
  readonly reset: () => void
}

export function usePreviewSubscribe(
  options: SubscriptionQuoteOptions = {}
): SubscriptionQuote {
  const { commands } = useBillingClient(options.client)
  const preview = ref<SubscriptionPreview | undefined>()
  const loading = ref(false)
  const failure = ref<SubscriptionCommandFailure | undefined>()

  let latest: AbortController | undefined

  function abandon() {
    latest?.abort()
    latest = undefined
    loading.value = false
  }

  async function quote(input: PreviewSubscribeInput) {
    abandon()
    const attempt = new AbortController()
    latest = attempt
    loading.value = true
    const result = await commands.previewSubscribe(input, {
      signal: attempt.signal
    })
    if (attempt !== latest) return result

    latest = undefined
    loading.value = false
    if (result.status === 'ok') {
      preview.value = result.value
      failure.value = undefined
    } else if (result.code === 'SUPERSEDED') {
      preview.value = undefined
      failure.value = undefined
    } else {
      failure.value = result
    }
    return result
  }

  function reset() {
    abandon()
    preview.value = undefined
    failure.value = undefined
  }

  return {
    preview: shallowReadonly(preview),
    loading: shallowReadonly(loading),
    failure: shallowReadonly(failure),
    quote,
    reset
  }
}
