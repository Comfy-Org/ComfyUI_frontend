<template>
  <div class="flex w-full flex-col">
    <header
      class="flex h-12 items-center justify-between gap-2 border-b border-border-default px-4"
    >
      <span class="text-sm text-base-foreground">
        {{ $t('openSharedWorkflow.dialogTitle') }}
      </span>
      <Button size="icon" :aria-label="$t('g.close')" @click="onCancel">
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </header>

    <template v-if="isLoading">
      <main class="flex gap-8 px-8 pt-4 pb-6">
        <div class="flex min-w-0 flex-1 flex-col gap-12 py-4">
          <Skeleton class="h-8 w-3/5" />
          <Skeleton class="h-4 w-4/5" />
        </div>
        <div class="flex w-84 shrink-0 flex-col gap-2 py-4">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-20 w-full rounded-lg" />
        </div>
      </main>
      <footer
        class="flex items-center justify-end gap-2.5 border-t border-border-default px-8 py-4"
      >
        <Skeleton class="h-10 w-24 rounded-md" />
        <Skeleton class="h-10 w-40 rounded-md" />
      </footer>
    </template>

    <template v-else-if="error">
      <main class="flex flex-col items-center gap-4 px-8 py-8">
        <i class="icon-[lucide--circle-alert] size-8 text-warning-background" />
        <p class="m-0 text-center text-sm text-muted-foreground">
          {{ $t('openSharedWorkflow.loadError') }}
        </p>
      </main>
      <footer
        class="flex items-center justify-end gap-2.5 border-t border-border-default px-8 py-4"
      >
        <Button variant="secondary" size="lg" @click="onCancel">
          {{ $t('g.close') }}
        </Button>
      </footer>
    </template>

    <template v-else-if="sharedWorkflow">
      <main :class="cn('flex gap-8 px-8 pt-4 pb-6', !hasAssets && 'flex-col')">
        <div class="flex min-w-0 flex-1 flex-col gap-12 py-4">
          <h2 class="m-0 text-2xl font-semibold text-base-foreground">
            {{ workflowName }}
          </h2>
          <p class="m-0 text-sm text-muted-foreground">
            {{ $t('openSharedWorkflow.copyDescription') }}
          </p>
        </div>

        <div v-if="hasAssets" class="flex w-84 shrink-0 flex-col gap-2 py-4">
          <div class="flex gap-2 items-start text-warning-background">
            <i class="icon-[lucide--circle-alert] shrink-0 w-4 h-lh" />
            <div class="m-0 p-0 text-sm">
              {{ $t('openSharedWorkflow.nonPublicAssetsWarningLine1') }}
              <br />
              {{ $t('openSharedWorkflow.nonPublicAssetsWarningLine2') }}
            </div>
          </div>

          <AssetSectionList :items="nonOwnedAssets" class="rounded-lg pb-2" />
        </div>
      </main>

      <footer
        class="flex items-center justify-end gap-2.5 border-t border-border-default px-8 py-4"
      >
        <Button variant="secondary" size="lg" @click="onCancel">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          v-if="hasAssets"
          variant="secondary"
          size="lg"
          @click="onOpenWithoutImporting(sharedWorkflow)"
        >
          {{ $t('openSharedWorkflow.openWithoutImporting') }}
        </Button>
        <Button variant="primary" size="lg" @click="onConfirm(sharedWorkflow)">
          {{
            hasAssets
              ? $t('openSharedWorkflow.copyAssetsAndOpen')
              : $t('openSharedWorkflow.openWorkflow')
          }}
        </Button>
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed } from 'vue'

import type { SharedWorkflowPayload } from '@/platform/workflow/sharing/types/shareTypes'
import AssetSectionList from '@/platform/workflow/sharing/components/AssetSectionList.vue'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { cn } from '@/utils/tailwindUtil'

const { shareId, onConfirm, onOpenWithoutImporting, onCancel } = defineProps<{
  shareId: string
  onConfirm: (payload: SharedWorkflowPayload) => void
  onOpenWithoutImporting: (payload: SharedWorkflowPayload) => void
  onCancel: () => void
}>()

const workflowShareService = useWorkflowShareService()

const {
  state: sharedWorkflow,
  isLoading,
  error
} = useAsyncState(() => workflowShareService.getSharedWorkflow(shareId), null)

const nonOwnedAssets = computed(
  () => sharedWorkflow.value?.assets.filter((a) => !a.in_library) ?? []
)

const hasAssets = computed(() => nonOwnedAssets.value.length > 0)

const workflowName = computed(() => {
  if (!sharedWorkflow.value) return ''
  if (sharedWorkflow.value.name) return sharedWorkflow.value.name
  const jsonName = (
    sharedWorkflow.value.workflowJson as Record<string, unknown>
  ).name
  if (typeof jsonName === 'string' && jsonName) return jsonName
  return ''
})
</script>
