<template>
  <div
    :class="
      cn('flex flex-col gap-4 rounded-lg border border-solid p-3', ui.summary)
    "
    data-testid="add-credits-auto-top-up"
  >
    <div class="flex items-start gap-3">
      <Checkbox
        :id="checkboxId"
        :model-value="checked"
        :disabled="locked"
        class="mt-0.5"
        data-testid="add-credits-auto-top-up-checkbox"
        @update:model-value="checked = $event === true"
      />
      <label :for="checkboxId" class="flex cursor-pointer flex-col gap-1">
        <span class="text-foreground">{{ translate('autoTopUp.label') }}</span>
        <span v-if="!checked" class="text-muted-foreground">
          {{ translate('autoTopUp.body') }}
        </span>
      </label>
    </div>

    <template v-if="checked">
      <AddCreditsAutoTopUpField
        name="threshold"
        :input="input.threshold"
        :label="translate('autoTopUp.threshold')"
        :error="messageFor('threshold')"
        :hint="translate('autoTopUp.thresholdHint')"
        :locked
        :ui
        @type="emit('edit', 'threshold', $event)"
      />
      <AddCreditsAutoTopUpField
        name="target"
        :input="input.target"
        :label="translate('autoTopUp.target')"
        :error="messageFor('target')"
        :hint="targetHint"
        :locked
        :ui
        @type="emit('edit', 'target', $event)"
      />
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <label :for="limitSwitchId" class="text-muted-foreground">
            {{ translate('autoTopUp.limit') }}
          </label>
          <Switch
            :id="limitSwitchId"
            :model-value="input.limitOn"
            :disabled="locked"
            data-testid="add-credits-auto-top-up-limit-switch"
            @update:model-value="emit('edit', 'limitOn', $event)"
          />
        </div>
        <AddCreditsAutoTopUpField
          v-if="input.limitOn"
          name="limit"
          prefix="$"
          :input="input.limit"
          :label="translate('autoTopUp.limit')"
          :error="messageFor('limit')"
          :hint="translate('autoTopUp.limitHint', { max: maxLimit })"
          :locked
          :ui
          @type="emit('edit', 'limit', $event)"
        />
        <p v-else class="m-0 text-muted-foreground">
          {{ translate('autoTopUp.limitOff', { max: maxLimit }) }}
        </p>
      </div>
      <p
        class="m-0 text-muted-foreground"
        data-testid="add-credits-auto-top-up-consent"
      >
        <template v-for="(part, index) in consent" :key="index">
          <a
            v-if="part === BILLING_TOKEN"
            :href="billingUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-inherit underline"
            >{{ translate('autoTopUp.billing')
            }}<i
              class="ml-0.5 icon-[lucide--arrow-up-right] size-3"
              aria-hidden="true"
          /></a>
          <template v-else>{{ part }}</template>
        </template>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import type {
  AddCreditsTranslate,
  AutoTopUpDefaultCard,
  AutoTopUpErrors,
  AutoTopUpField,
  AutoTopUpFormInput,
  AutoTopUpFormValues,
  AutoTopUpRules
} from '@comfyorg/account-core/billing'
import { eachTopUpAtLeastCents } from '@comfyorg/account-core/billing'
import Checkbox from '@comfyorg/design-system/checkbox/Checkbox'
import Switch from '@comfyorg/design-system/switch/Switch'
import { cn } from '@comfyorg/tailwind-utils'

import AddCreditsAutoTopUpField from './AddCreditsAutoTopUpField.vue'
import type { AddCreditsFormat, AddCreditsUi } from './addCreditsPresentation'
import type { AutoTopUpEdit } from './useAddCreditsAutoTopUp'
import {
  BILLING_TOKEN,
  autoTopUpConsentParts,
  autoTopUpFieldMessage
} from './addCreditsPresentation'

const {
  rules,
  defaultCard,
  input,
  values,
  errors,
  billingUrl,
  locked,
  translate,
  format,
  ui
} = defineProps<{
  rules: AutoTopUpRules
  defaultCard: AutoTopUpDefaultCard | null
  input: AutoTopUpFormInput
  values: AutoTopUpFormValues
  errors: AutoTopUpErrors
  billingUrl: string
  locked: boolean
  translate: AddCreditsTranslate
  format: AddCreditsFormat
  ui: AddCreditsUi
}>()

const checked = defineModel<boolean>('checked', { required: true })

const emit = defineEmits<{
  edit: AutoTopUpEdit
}>()

const checkboxId = useId()
const limitSwitchId = useId()

const maxLimit = computed(() => format.dollars(rules.maxMonthlyBudgetCents))

const targetHint = computed(() => {
  const cents = eachTopUpAtLeastCents(values)
  return cents === null || values.targetCredits === null
    ? undefined
    : translate('autoTopUp.targetHint', {
        target: format.count(values.targetCredits),
        amount: format.money(cents)
      })
})

const consentMax = computed(() =>
  format.dollars(values.budgetCents ?? rules.maxMonthlyBudgetCents)
)

const consent = computed(() =>
  autoTopUpConsentParts(defaultCard, consentMax.value, translate)
)

function messageFor(field: AutoTopUpField): string | undefined {
  const error = errors[field]
  return error === undefined
    ? undefined
    : autoTopUpFieldMessage(error, values, rules, { translate, format })
}
</script>
