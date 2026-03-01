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

    <main
      :class="
        cn('flex gap-8 px-8 pt-4 pb-6', hasAssets ? 'flex-row' : 'flex-col')
      "
    >
      <div class="flex flex-col gap-12 py-4">
        <h2 class="m-0 text-2xl font-semibold text-base-foreground">
          {{ workflowName }}
        </h2>
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('openSharedWorkflow.copyDescription') }}
        </p>
      </div>

      <div v-if="hasAssets" class="flex flex-col gap-2 py-4">
        <div class="flex gap-2 items-center">
          <i
            class="icon-[lucide--circle-alert] shrink-0 size-4 text-warning-background"
          />
          <p class="m-0 text-sm text-warning-background">
            {{ $t('openSharedWorkflow.nonPublicAssetsWarningLine1') }}
            <br />
            {{ $t('openSharedWorkflow.nonPublicAssetsWarningLine2') }}
          </p>
        </div>

        <AssetSectionList :assets :models class="rounded-lg pb-2" />
      </div>
    </main>

    <footer
      class="flex items-center justify-end gap-2.5 border-t border-border-default px-8 py-4"
    >
      <Button variant="secondary" size="lg" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="primary" size="lg" @click="onConfirm">
        {{
          hasAssets
            ? $t('openSharedWorkflow.copyAssetsAndOpen')
            : $t('openSharedWorkflow.openWorkflow')
        }}
      </Button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { WorkflowAsset, WorkflowModel } from '@/schemas/apiSchema'
import AssetSectionList from '@/platform/workflow/sharing/components/AssetSectionList.vue'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const {
  workflowName,
  assets = [],
  models = [],
  onConfirm,
  onCancel
} = defineProps<{
  workflowName: string
  assets?: WorkflowAsset[]
  models?: WorkflowModel[]
  onConfirm: () => void
  onCancel: () => void
}>()

const hasAssets = computed(() => assets.length > 0 || models.length > 0)
</script>
