<template>
  <PackCardLayout
    :name="revision.name"
    :is-selected
    @click="$emit('select', revision.revision_id)"
  >
    <template #name>
      <button
        type="button"
        class="cursor-pointer truncate border-0 bg-transparent p-0 text-left text-xs font-bold text-base-foreground"
        :aria-label="
          $t('customNodePacks.registry.detailsNamed', { name: revision.name })
        "
        :aria-pressed="isSelected"
        @click.stop="$emit('select', revision.revision_id)"
      >
        {{ revision.name }}
      </button>
    </template>
    <div class="flex flex-wrap items-center gap-2 py-1 text-xs">
      <span>{{ $t('g.nodesCount', revision.nodes.length) }}</span>
      <span class="rounded-md bg-secondary-background px-2 py-1">
        {{
          revision.node_api_version
            ? $t('customNodePacks.registry.apiVersion', {
                version: revision.node_api_version
              })
            : $t('customNodePacks.registry.versionUnknown')
        }}
      </span>
    </div>
    <span class="text-xs text-muted-foreground">
      {{
        $t('customNodePacks.registry.revision', {
          commit:
            revision.upstream_commit.slice(0, 12) ||
            $t('customNodePacks.registry.provenanceMissing'),
          digest: revision.revision_id.slice(0, 12)
        })
      }}
    </span>
    <span class="flex items-center gap-1 py-1 text-xs">
      <i
        v-if="revision.comfy_verified"
        class="icon-[lucide--badge-check] size-4"
      />
      {{
        $t(
          revision.comfy_verified
            ? 'customNodePacks.registry.verified'
            : 'customNodePacks.registry.unverified'
        )
      }}
    </span>
    <span class="pb-2 text-xs text-muted-foreground">
      {{
        $t(
          revision.prepared
            ? 'customNodePacks.registry.prepared'
            : 'customNodePacks.registry.pending'
        )
      }}
    </span>
    <template #footer>
      <div class="flex min-h-12 items-center justify-between gap-2 px-3 py-2">
        <span class="text-xs text-muted-foreground">
          {{
            $t(
              revision.pinned
                ? 'customNodePacks.registry.pinned'
                : 'customNodePacks.registry.notPinned'
            )
          }}
        </span>
        <CloudNodePinButton
          :revision
          :busy
          :blocked
          :saving-revision
          @pin="(id, pinned) => $emit('pin', id, pinned)"
        />
      </div>
    </template>
  </PackCardLayout>
</template>

<script setup lang="ts">
import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'

import PackCardLayout from '@/components/common/PackCardLayout.vue'

import CloudNodePinButton from './CloudNodePinButton.vue'

const {
  revision,
  isSelected = false,
  busy,
  blocked,
  savingRevision
} = defineProps<{
  revision: CloudNodeRegistryRevision
  isSelected?: boolean
  busy: boolean
  blocked: boolean
  savingRevision?: string
}>()
defineEmits<{
  select: [revisionId: string]
  pin: [revisionId: string, pinned: boolean]
}>()
</script>
