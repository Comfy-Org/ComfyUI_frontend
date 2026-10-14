<template>
  <div
    class="flex w-full max-w-lg flex-col rounded-2xl border border-border bg-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border px-4"
    >
      <h2 class="m-0 text-sm font-normal text-foreground">
        {{ t('auth.sso.outsideOrganization.title') }}
      </h2>
      <Button
        size="icon"
        variant="muted-textonly"
        :aria-label="t('g.close')"
        @click="dismiss"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </div>

    <p class="m-0 p-4 text-sm text-muted-foreground">
      {{ t('auth.sso.outsideOrganization.body') }}
    </p>

    <div class="flex items-center justify-end p-4">
      <Button variant="secondary" size="lg" autofocus @click="dismiss">
        {{ t('g.close') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { ACCOUNT_OUTSIDE_ORGANIZATION_DIALOG_KEY } from '@/platform/auth/sso/ssoRequiredDialogKey'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()
const dialogStore = useDialogStore()

function dismiss() {
  dialogStore.closeDialog({ key: ACCOUNT_OUTSIDE_ORGANIZATION_DIALOG_KEY })
}
</script>
