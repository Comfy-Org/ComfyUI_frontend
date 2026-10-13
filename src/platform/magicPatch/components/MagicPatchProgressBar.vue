<template>
  <section
    v-if="store.visible"
    class="border-border flex max-h-40 shrink-0 flex-col gap-2 overflow-auto border-t bg-comfy-menu-bg px-4 py-2"
    :aria-label="t('magicPatch.progressTitle')"
    data-testid="magic-patch-progress-bar"
  >
    <div class="flex items-center justify-between gap-3">
      <p role="status" aria-live="polite" class="m-0 text-sm font-medium">
        {{
          t(
            store.ready
              ? 'magicPatch.completedTitle'
              : 'magicPatch.progressTitle'
          )
        }}
      </p>
      <Button
        v-if="store.ready"
        variant="secondary"
        size="sm"
        @click="showCompletion"
        >{{ t('magicPatch.reviewCompletion') }}</Button
      >
      <Button
        v-else-if="store.settled"
        variant="textonly"
        size="sm"
        @click="store.dismissFinished"
        >{{ t('g.close') }}</Button
      >
    </div>
    <div
      v-for="job in store.jobs"
      :key="job.revision.revision_id"
      class="flex flex-wrap items-center gap-2 text-xs"
    >
      <span class="font-medium">{{ job.revision.name }}</span>
      <template v-if="job.state.phase === 'active'">
        <span>{{ t(`magicPatch.states.${job.state.request.state}`) }}</span>
        <span v-if="job.executionMode === 'cached_patch'">{{
          t('magicPatch.cachedConversionUsed')
        }}</span>
        <span v-if="job.state.request.stage">{{
          t(`magicPatch.stages.${job.state.request.stage}`)
        }}</span>
        <span
          v-if="job.state.request.estimated_seconds_remaining !== undefined"
          >{{
            t('magicPatch.estimate', {
              seconds: job.state.request.estimated_seconds_remaining
            })
          }}</span
        >
        <span v-if="job.state.disconnected" role="alert">{{
          t('magicPatch.disconnected')
        }}</span>
        <Button
          v-if="
            ['waiting_conversion', 'waiting_install'].includes(
              job.state.request.state
            )
          "
          variant="textonly"
          size="sm"
          @click="store.cancel(job.revision.revision_id)"
          >{{ t('g.cancel') }}</Button
        >
        <Button
          v-if="job.state.request.report_sha256"
          variant="textonly"
          size="sm"
          @click="store.readReport(job.revision.revision_id)"
          >{{ t('magicPatch.report') }}</Button
        >
      </template>
      <template v-else-if="job.state.phase === 'retry'">
        <span role="alert">{{ t('magicPatch.uncertain') }}</span>
        <Button
          variant="secondary"
          size="sm"
          @click="store.retry(job.revision.revision_id)"
          >{{ t('magicPatch.retry') }}</Button
        >
      </template>
      <span v-else-if="job.state.phase === 'error'" role="alert">{{
        t('magicPatch.unavailable')
      }}</span>
      <span v-else>{{ t('magicPatch.submitting') }}</span>
      <pre
        v-if="job.report !== undefined"
        class="max-h-24 w-full overflow-auto whitespace-pre-wrap"
        >{{ JSON.stringify(job.report, null, 2) }}</pre>
    </div>
    <p v-if="store.actionFailed" role="alert" class="m-0 text-xs">
      {{ t('magicPatch.actionFailed') }}
    </p>
  </section>
</template>
<script setup lang="ts">
import { useDocumentVisibility, useIntervalFn, useOnline } from '@vueuse/core'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'
import MagicPatchBatchDialog from './MagicPatchBatchDialog.vue'
import { useMagicPatchBatchStore } from '../stores/magicPatchBatchStore'
const { t } = useI18n()
const store = useMagicPatchBatchStore()
const dialogs = useDialogStore()
const online = useOnline()
const visibility = useDocumentVisibility()
useIntervalFn(() => {
  if (store.visible && online.value && visibility.value === 'visible')
    void store.refresh()
}, 5000)
function showCompletion() {
  dialogs.showDialog({
    key: 'magic-patch-completed',
    title: t('magicPatch.completedTitle'),
    component: MagicPatchBatchDialog,
    props: { completed: true },
    dialogComponentProps: { modal: true, size: 'md' }
  })
}
watch(
  () => store.consentOpen,
  (open) => {
    if (open)
      dialogs.showDialog({
        key: 'magic-patch-consent',
        title: t('magicPatch.batchTitle'),
        component: MagicPatchBatchDialog,
        dialogComponentProps: {
          modal: true,
          size: 'md',
          onClose: store.dismissConsent
        }
      })
    else dialogs.closeDialog({ key: 'magic-patch-consent' })
  },
  { immediate: true }
)
watch(
  () => store.ready,
  (ready) => {
    if (ready && !store.completionAnnounced) {
      store.completionAnnounced = true
      showCompletion()
    }
  },
  { immediate: true }
)
watch(
  () => store.visible,
  (visible) => {
    if (!visible) dialogs.closeDialog({ key: 'magic-patch-completed' })
  }
)
</script>
