<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useSignInHref } from '../../composables/useSignInHref'
import { leaveForSignIn } from '../../config/workshop-return'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import type { WorkflowState } from '../../config/workshop-workflow-state'
import { t } from '../../i18n/translations'

const { state, signedIn, canStart, statusLabel } = defineProps<{
  state: WorkflowState
  signedIn: boolean
  canStart: boolean
  statusLabel: string
}>()
const emit = defineEmits<{ resume: []; cancel: []; dismiss: [] }>()
const signInHref = useSignInHref()
const busy = computed(() =>
  ['preparing', 'active', 'interrupted'].includes(state.phase)
)
const spinning = computed(() => busy.value && state.phase !== 'interrupted')
const unknownSubmission = computed(
  () => state.phase === 'interrupted' && state.record.stage === 'intent'
)
const canResume = computed(
  () => state.phase === 'interrupted' && !unknownSubmission.value
)
const canCancel = computed(() => {
  const observation = 'observation' in state ? state.observation : undefined
  const requested = 'record' in state && state.record.cancelRequested
  return (
    busy.value &&
    !unknownSubmission.value &&
    !requested &&
    !['succeeded', 'failed', 'cancelled'].includes(observation?.run.state ?? '')
  )
})
</script>

<template>
  <Button
    v-if="!signedIn"
    as="a"
    size="lg"
    class="w-full"
    :href="signInHref"
    @click="leaveForSignIn($event, signInHref)"
    >{{ t('workshop.run.signIn') }}</Button
  >
  <Button
    v-else
    type="submit"
    size="lg"
    class="w-full"
    :disabled="!canStart"
    data-testid="workflow-run"
  >
    <template v-if="spinning" #prepend>
      <Loader2
        class="size-4 motion-safe:animate-spin"
        aria-hidden="true"
        data-testid="run-button-spinner"
      />
    </template>
    {{ busy ? statusLabel : t('workshop.run.run') }}
  </Button>
  <div
    v-if="canCancel || state.phase === 'interrupted'"
    class="flex flex-wrap gap-2"
  >
    <Button
      v-if="canResume"
      type="button"
      variant="outline"
      class="min-h-11 grow"
      @click="emit('resume')"
      >{{ t('workshop.workflow.resume') }}</Button
    >
    <Button
      v-if="canCancel"
      type="button"
      variant="outline"
      class="min-h-11 grow"
      @click="emit('cancel')"
      >{{ t('workshop.run.cancel') }}</Button
    >
    <template v-if="unknownSubmission">
      <Button
        as="a"
        :href="WORKSHOP_CLOUD_BASE_URL"
        target="_blank"
        rel="noopener"
        variant="outline"
        >{{ t('workshop.workflow.checkCloud') }}</Button
      >
      <Button type="button" variant="outline" @click="emit('dismiss')">{{
        t('workshop.workflow.dismissUnknown')
      }}</Button>
    </template>
  </div>
  <p v-if="busy" class="text-xs/relaxed text-primary-warm-gray">
    {{ t('workshop.workflow.resumeHint') }}
  </p>
</template>
