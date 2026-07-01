<template>
  <p class="m-0 text-center text-xs text-muted-foreground">
    <template v-if="context === 'payment_method'">
      <i18n-t keypath="billing.consent.paymentMethodBody" tag="span">
        <template #settingsLink>
          <button
            class="cursor-pointer border-none bg-transparent p-0 text-xs text-muted-foreground underline transition-colors hover:text-base-foreground"
            @click="openSettings"
          >
            {{ $t('billing.consent.settingsLink') }}
          </button>
        </template>
      </i18n-t>
    </template>
    <template v-else>
      <i18n-t keypath="subscription.preview.termsAgreement" tag="span">
        <template #terms>
          <a
            href="https://www.comfy.org/terms"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-base-foreground"
          >
            {{ $t('subscription.preview.terms') }}
          </a>
        </template>
        <template #privacy>
          <a
            href="https://www.comfy.org/privacy"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-base-foreground"
          >
            {{ $t('subscription.preview.privacyPolicy') }}
          </a>
        </template>
      </i18n-t>
    </template>
  </p>
</template>

<script setup lang="ts">
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'

const { context = 'subscription' } = defineProps<{
  context?: 'subscription' | 'payment_method'
}>()

const settingsDialog = useSettingsDialog()

function openSettings() {
  settingsDialog.show('workspace')
}
</script>
