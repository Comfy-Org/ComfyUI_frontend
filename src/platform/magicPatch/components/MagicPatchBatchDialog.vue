<template>
  <div class="flex flex-col gap-4 p-4">
    <p class="m-0 text-sm">
      {{
        t(
          completed
            ? 'magicPatch.completedDescription'
            : 'magicPatch.batchConsent'
        )
      }}
    </p>
    <ul class="m-0 flex max-h-64 list-none flex-col gap-2 overflow-auto p-0">
      <li
        v-for="revision in revisions"
        :key="revision.revision_id"
        class="flex flex-col gap-1"
      >
        <span class="text-sm font-medium">{{ revision.name }}</span>
        <span class="text-xs text-muted-foreground">{{
          t('magicPatch.revision', {
            revision: revision.upstream_commit.slice(0, 12)
          })
        }}</span>
      </li>
    </ul>
    <p v-if="!completed" class="m-0 text-xs text-muted-foreground">
      {{ t('magicPatch.description') }}
    </p>
    <p v-if="store.actionFailed" role="alert" class="m-0 text-sm">
      {{ t('magicPatch.actionFailed') }}
    </p>
    <div class="flex justify-end gap-2">
      <Button variant="textonly" @click="close">{{
        t(completed ? 'magicPatch.later' : 'g.cancel')
      }}</Button>
      <Button
        variant="secondary"
        :loading="store.reloading"
        :disabled="completed && !store.ready"
        @click="accept"
      >
        {{
          t(
            completed ? 'magicPatch.acknowledgeReload' : 'magicPatch.convertAll'
          )
        }}
      </Button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'
import { useMagicPatchBatchStore } from '../stores/magicPatchBatchStore'
const { completed = false } = defineProps<{ completed?: boolean }>()
const { t } = useI18n()
const store = useMagicPatchBatchStore()
const dialogs = useDialogStore()
const revisions = computed(() =>
  completed ? store.jobs.map((job) => job.revision) : store.candidates
)
function close() {
  if (!completed) store.dismissConsent()
  dialogs.closeDialog({
    key: completed ? 'magic-patch-completed' : 'magic-patch-consent'
  })
}
async function accept() {
  if (completed) {
    if (await store.acknowledge()) close()
  } else {
    void store.confirm()
    close()
  }
}
</script>
