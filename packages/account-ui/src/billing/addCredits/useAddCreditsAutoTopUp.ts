import { computed, shallowRef, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type {
  AddCreditsAutoTopUpOffer,
  AutoTopUpActivation,
  AutoTopUpFormInput
} from '@comfyorg/account-core/billing'
import {
  autoTopUpActivationFor,
  autoTopUpTargetFor,
  CREDITS_PER_USD,
  parseAutoTopUpForm,
  startAutoTopUpForm,
  validateAutoTopUp
} from '@comfyorg/account-core/billing'

/** What Continue sends about auto top-up with this purchase. */
export type AddCreditsAutoTopUpRequest =
  | { readonly kind: 'not_offered' }
  | { readonly kind: 'unchecked' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'checked'; readonly activation: AutoTopUpActivation }

export function useAddCreditsAutoTopUp(
  offer: MaybeRefOrGetter<AddCreditsAutoTopUpOffer>,
  amountCents: MaybeRefOrGetter<number | undefined>
) {
  const checked = shallowRef(false)
  const targetEdited = shallowRef(false)
  const edits = shallowRef<Partial<AutoTopUpFormInput>>({})

  const creditsPicked = computed(() =>
    Math.round(((toValue(amountCents) ?? 0) * CREDITS_PER_USD) / 100)
  )

  const input = computed<AutoTopUpFormInput>(() => {
    const merged = {
      ...startAutoTopUpForm(creditsPicked.value),
      ...edits.value
    }
    return targetEdited.value
      ? merged
      : {
          ...merged,
          target: autoTopUpTargetFor(merged.threshold, creditsPicked.value)
        }
  })

  const values = computed(() => parseAutoTopUpForm(input.value))

  const rules = computed(() => {
    const current = toValue(offer)
    return current.kind === 'checkbox' ? current.rules : undefined
  })

  const errors = computed(() =>
    rules.value && checked.value
      ? validateAutoTopUp(values.value, rules.value)
      : {}
  )

  const request = computed<AddCreditsAutoTopUpRequest>(() => {
    if (!rules.value) return { kind: 'not_offered' }
    if (!checked.value) return { kind: 'unchecked' }
    const activation = autoTopUpActivationFor(values.value, rules.value)
    return activation === null
      ? { kind: 'invalid' }
      : { kind: 'checked', activation }
  })

  function edit(field: keyof AutoTopUpFormInput, value: string | boolean) {
    if (field === 'target') targetEdited.value = true
    edits.value = { ...edits.value, [field]: value }
  }

  return { checked, input, values, errors, request, edit }
}
