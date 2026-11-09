<template>
  <DeploymentDialogFrame
    data-testid="run-on-cloud-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <DialogTitle class="my-0 pr-8 text-2xl/8 font-bold tracking-tight">
        {{ $t('openOnCloud.runDialog.title') }}
      </DialogTitle>
      <p class="my-0 text-sm/5 text-muted-foreground">
        {{ $t('openOnCloud.runDialog.ready') }}
      </p>
      <p v-if="asksToSignIn" class="my-0 text-sm/5 text-muted-foreground">
        {{ $t('openOnCloud.runDialog.asksToSignIn') }}
      </p>
      <footer class="flex items-center justify-end gap-2.5 pt-3">
        <Button variant="secondary" size="lg" @click="emit('dismiss')">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          variant="inverted"
          size="lg"
          data-testid="run-on-cloud-primary"
          @click="openOnCloud"
        >
          {{ $t('openOnCloud.runDialog.openOnCloud') }}
          <i class="icon-[lucide--external-link]" aria-hidden="true" />
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

defineProps<{ asksToSignIn: boolean }>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

function openOnCloud() {
  void openWorkflowOnCloud()
  emit('done')
}
</script>
