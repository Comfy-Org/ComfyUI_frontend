<template>
  <div :class="cn('flex flex-col gap-4 p-4', ui.body)">
    <div
      v-if="settings"
      :class="
        cn('flex flex-col gap-1 rounded-lg border border-solid p-3', ui.summary)
      "
      data-testid="add-credits-auto-top-up-on"
    >
      <span class="text-foreground">
        {{
          translate('autoTopUpOn.summary', {
            threshold: format.count(settings.threshold_credits),
            target: format.count(settings.target_credits)
          })
        }}
      </span>
      <span
        v-if="settings.monthly_budget_cents !== null"
        class="text-muted-foreground"
      >
        {{
          translate('autoTopUpOn.limit', {
            limit: format.dollars(settings.monthly_budget_cents)
          })
        }}
      </span>
      <span v-else class="text-muted-foreground">
        {{ translate('autoTopUpOn.noLimit') }}
      </span>
    </div>
    <p
      v-else
      class="m-0 text-muted-foreground"
      data-testid="add-credits-auto-top-up-failed"
    >
      {{ translate('autoTopUpFailed.body') }}
    </p>
  </div>
  <div :class="footerBarClass(ui, 'justify-end')">
    <AddCreditsBillingLink
      v-if="linkUrl"
      :to="linkUrl"
      :class="
        cn(
          buttonVariants({ variant: 'muted-textonly', size: 'lg' }),
          ui.secondary
        )
      "
      data-testid="add-credits-auto-top-up-link"
      @click="emit('openBilling')"
    >
      {{ translate(settings ? 'autoTopUp.manage' : 'autoTopUpOffer.setUp') }}
      <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
    </AddCreditsBillingLink>
    <button
      type="button"
      :class="primaryActionClass(ui)"
      data-testid="add-credits-auto-top-up-done"
      @click="emit('close')"
    >
      {{ translate('autoTopUpOn.done') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type {
  AddCreditsTranslate,
  AutoTopUpActivation
} from '@comfyorg/account-core/billing'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import AddCreditsBillingLink from './AddCreditsBillingLink.vue'
import type {
  AddCreditsBillingLinkTarget,
  AddCreditsFormat,
  AddCreditsUi
} from './addCreditsPresentation'
import { footerBarClass, primaryActionClass } from './addCreditsPresentation'

const { settings, linkUrl, translate, format, ui } = defineProps<{
  settings?: AutoTopUpActivation
  linkUrl?: AddCreditsBillingLinkTarget
  translate: AddCreditsTranslate
  format: AddCreditsFormat
  ui: AddCreditsUi
}>()

const emit = defineEmits<{ close: []; openBilling: [] }>()
</script>
