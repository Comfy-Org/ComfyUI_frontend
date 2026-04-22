<template>
  <div class="flex w-full flex-col">
    <header
      class="flex h-12 items-center justify-between gap-2 border-b border-border-default px-4"
    >
      <h2 class="text-sm text-base-foreground">
        {{ $t('openSharedWorkflow.dialogTitle') }}
      </h2>
      <Button size="icon" :aria-label="$t('g.close')" @click="onCancel">
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </header>

    <template v-if="isLoading">
      <main class="flex gap-8 px-8 pt-4 pb-6">
        <div role="status" class="flex min-w-0 flex-1 flex-col gap-12 py-4">
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
      <main class="flex flex-col items-center gap-4 p-8">
        <i
          class="icon-[lucide--circle-alert] size-8 text-warning-background"
          aria-hidden="true"
        />
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

        <div v-if="hasAssets" class="flex w-96 shrink-0 flex-col gap-2 py-4">
          <CollapsibleRoot
            v-model:open="isWarningExpanded"
            class="overflow-hidden rounded-lg bg-secondary-background"
          >
            <CollapsibleTrigger as-child>
              <Button
                variant="secondary"
                class="w-full justify-between px-4 py-1 text-sm"
              >
                <i
                  class="icon-[lucide--circle-alert] size-4 shrink-0 text-warning-background"
                  aria-hidden="true"
                />
                <span
                  class="m-0 flex-1 text-left text-sm text-muted-foreground"
                >
                  {{ $t('openSharedWorkflow.nonPublicAssetsWarningLine1') }}
                </span>
                <i
                  :class="
                    cn(
                      'icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground transition-transform',
                      isWarningExpanded && 'rotate-90'
                    )
                  "
                />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent
              class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
            >
              <AssetSectionList :items="nonOwnedAssets" />
            </CollapsibleContent>
          </CollapsibleRoot>
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
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

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
const isWarningExpanded = ref(true)

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
