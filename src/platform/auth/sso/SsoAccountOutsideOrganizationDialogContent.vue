<template>
  <DialogPanel class="w-full max-w-lg" @close="dismiss">
    <template #title>
      {{ t('auth.sso.outsideOrganization.title') }}
    </template>

    <p class="m-0 p-4 text-sm text-muted-foreground">
      {{ t('auth.sso.outsideOrganization.body') }}
    </p>

    <template #footer>
      <Button variant="secondary" size="lg" autofocus @click="dismiss">
        {{ t('g.close') }}
      </Button>
    </template>
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
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
