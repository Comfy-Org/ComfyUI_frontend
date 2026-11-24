<template>
  <DeploymentDialogFrame
    data-testid="run-on-cloud-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <DialogTitle class="my-0 pr-8 text-2xl/8 font-bold tracking-tight">
        {{ $t('openOnCloud.runDialog.title') }}
      </DialogTitle>
      <DialogDescription class="my-0 text-sm/5 whitespace-pre-line">
        {{ readyMessage }}
      </DialogDescription>
      <p v-if="asksToSignIn" class="my-0 text-sm/5 text-muted-foreground">
        {{ $t('openOnCloud.runDialog.asksToSignIn') }}
      </p>
      <footer class="flex flex-wrap items-center justify-end gap-2.5 pt-3">
        <Button variant="secondary" size="lg" @click="emit('dismiss')">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          variant="inverted"
          size="lg"
          data-testid="run-on-cloud-primary"
          :disabled="checking"
          @click="openOnCloud"
        >
          {{
            checking
              ? $t('openOnCloud.cloudButton.checking')
              : $t('openOnCloud.runDialog.openOnCloud')
          }}
          <i
            v-if="!checking"
            class="icon-[lucide--external-link]"
            aria-hidden="true"
          />
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import DialogDescription from '@comfyorg/design-system/dialog/DialogDescription'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { useTelemetry } from '@comfyorg/telemetry'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UncheckedModelInput } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const {
  asksToSignIn,
  workspaceId,
  uncheckedInputs = [],
  needsConsent = false,
  checking = false
} = defineProps<{
  asksToSignIn: boolean
  workspaceId?: string
  uncheckedInputs?: UncheckedModelInput[]
  needsConsent?: boolean
  checking?: boolean
}>()

const { t } = useI18n()

const readyMessage = computed(() => {
  if (needsConsent) return t('openOnCloud.cloudButton.checkDisclosure')
  return uncheckedInputs.length
    ? t('openOnCloud.runDialog.readyWithUncheckedInputs', {
        inputs: uncheckedInputs
          .map(({ nodeType, input }) =>
            t('openOnCloud.runDialog.uncheckedInput', { nodeType, input })
          )
          .join(', ')
      })
    : t('openOnCloud.runDialog.ready')
})

const emit = defineEmits<{
  requestOpen: []
  done: []
  dismiss: []
}>()

function openOnCloud() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'run_on_cloud_open_on_cloud_clicked',
    element_group: 'run_on_cloud'
  })
  if (needsConsent) {
    emit('requestOpen')
    return
  }
  void openWorkflowOnCloud(undefined, asksToSignIn ? undefined : workspaceId)
  emit('done')
}
</script>
