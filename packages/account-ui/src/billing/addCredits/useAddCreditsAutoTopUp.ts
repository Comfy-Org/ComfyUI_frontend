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
  parseAutoTopUpForm,
  startAutoTopUpForm,
  validateAutoTopUp
} from '@comfyorg/account-core/billing'

import { centsToCredits } from '#/billing/tab/creditsCardCopy'

export type AddCreditsAutoTopUpRequest =
  | { readonly kind: 'not_offered' }
  | { readonly kind: 'unchecked' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'checked'; readonly activation: AutoTopUpActivation }

export type AutoTopUpEdit = {
  [K in keyof AutoTopUpFormInput]: [field: K, value: AutoTopUpFormInput[K]]
}[keyof AutoTopUpFormInput]

export function useAddCreditsAutoTopUp(
  offer: MaybeRefOrGetter<AddCreditsAutoTopUpOffer>,
  amountCents: MaybeRefOrGetter<number | undefined>
) {
  const checked = shallowRef(false)
  const edits = shallowRef<Partial<AutoTopUpFormInput>>({})

  const creditsPicked = computed(() =>
    centsToCredits(toValue(amountCents) ?? 0)
  )

  const input = computed<AutoTopUpFormInput>(() => {
    const merged = {
      ...startAutoTopUpForm(creditsPicked.value),
      ...edits.value
    }
    return edits.value.target !== undefined
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

  function edit(...[field, value]: AutoTopUpEdit) {
    edits.value = { ...edits.value, [field]: value }
  }

  return { checked, input, values, errors, request, edit }
}
