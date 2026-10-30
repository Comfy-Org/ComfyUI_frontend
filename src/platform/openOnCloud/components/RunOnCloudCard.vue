<template>
  <DeploymentDialogFrame
    data-testid="run-on-cloud-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <h2
        :id="titleId"
        class="my-0 pr-8 text-2xl/8 font-bold tracking-tight text-foreground"
      >
        {{ $t('openOnCloud.runDialog.title') }}
      </h2>
      <p class="my-0 text-sm/5 text-muted-foreground">{{ body }}</p>
      <footer class="flex items-center justify-end gap-2.5 pt-3">
        <Button variant="secondary" size="lg" @click="emit('dismiss')">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          variant="inverted"
          size="lg"
          data-testid="run-on-cloud-primary"
          @click="runPrimary"
        >
          <template v-if="state.kind === 'signedOut'">
            {{ $t('openOnCloud.runDialog.signIn') }}
          </template>
          <template v-else>
            {{ $t('openOnCloud.runDialog.openOnCloud') }}
            <i class="icon-[lucide--external-link]" aria-hidden="true" />
          </template>
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import type { RunOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const { state } = defineProps<{
  titleId?: string
  state: Extract<RunOnCloudModalState, { kind: 'ready' | 'signedOut' }>
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const { t } = useI18n()
const { showSignInDialog } = useAuthDialogs()

const BODY_KEYS = {
  ready: 'openOnCloud.runDialog.ready',
  signedOut: 'openOnCloud.runDialog.signedOut'
} as const

const body = computed(() => t(BODY_KEYS[state.kind]))

function runPrimary() {
  switch (state.kind) {
    case 'ready':
      void openWorkflowOnCloud()
      break
    case 'signedOut':
      void showSignInDialog()
      break
  }
  emit('done')
}
</script>
