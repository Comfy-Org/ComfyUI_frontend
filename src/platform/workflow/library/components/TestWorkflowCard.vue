<script setup lang="ts">
import type { TestWorkflowSummary } from '@comfyorg/ingest-types/test-workflows'

import PackCardLayout from '@/components/common/PackCardLayout.vue'
import Button from '@/components/ui/button/Button.vue'

const {
  entry,
  selected = false,
  busy = false
} = defineProps<{
  entry: TestWorkflowSummary
  selected?: boolean
  busy?: boolean
}>()
defineEmits<{ select: [hash: string]; open: [hash: string] }>()
</script>

<template>
  <div class="relative rounded-lg text-left">
    <button
      type="button"
      :disabled="busy"
      :aria-pressed="selected"
      :aria-label="entry.name"
      class="absolute inset-0 z-10 rounded-lg border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2"
      @click="$emit('select', entry.workflow_sha256)"
    />
    <PackCardLayout
      :name="entry.name"
      :description="entry.description"
      :is-selected="selected"
      :disabled="busy"
    >
      <template #name>
        <span
          class="line-clamp-2 text-sm font-semibold wrap-break-word"
          :title="entry.name"
          >{{ entry.name }}</span
        >
      </template>
      <span class="text-xs text-muted-foreground">{{
        $t('testWorkflowLibrary.nodeCount', { count: entry.node_count })
      }}</span>
      <span
        v-if="entry.unresolved_pack_count"
        class="text-xs text-muted-foreground"
        >{{
          $t('testWorkflowLibrary.unresolvedPacks', {
            count: entry.unresolved_pack_count
          })
        }}</span
      >
      <div class="flex flex-wrap gap-1 py-2">
        <span
          v-for="tag in entry.tags.slice(0, 4)"
          :key="tag"
          class="max-w-full truncate rounded-sm bg-secondary-background px-2 py-1 text-xs text-muted-foreground"
          >{{ tag }}</span
        >
      </div>
      <template #footer>
        <div class="flex items-center justify-between gap-2 px-3 py-2">
          <span class="text-xs text-muted-foreground">{{
            $t(
              entry.verified
                ? 'testWorkflowLibrary.verified'
                : 'testWorkflowLibrary.notVerified'
            )
          }}</span>
          <Button
            variant="secondary"
            size="md"
            class="relative z-20 shrink-0"
            :disabled="busy"
            :aria-label="
              $t('testWorkflowLibrary.openEntry', { name: entry.name })
            "
            @click="$emit('open', entry.workflow_sha256)"
            >{{ $t('testWorkflowLibrary.open') }}</Button
          >
        </div>
      </template>
    </PackCardLayout>
  </div>
</template>
