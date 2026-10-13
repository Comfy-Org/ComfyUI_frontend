<template>
  <div v-if="groups.length" class="mt-3 flex flex-col gap-3">
    <p
      v-if="registry.state.value.phase === 'error'"
      role="alert"
      class="m-0 text-sm"
    >
      {{ t('magicPatch.unavailable') }}
    </p>
    <Button
      v-if="candidates.length"
      variant="secondary"
      :disabled="store.visible"
      @click="store.offer(candidates)"
      >{{ t('magicPatch.reviewPacks') }}</Button
    >
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import { useCloudNodeRegistry } from '@/platform/customNodes/composables/useCloudNodeRegistry'
import Button from '@/components/ui/button/Button.vue'
import { useMagicPatchBatchStore } from '../stores/magicPatchBatchStore'

const { groups } = defineProps<{ groups: MissingPackGroup[] }>()
const { t } = useI18n()
const registry = useCloudNodeRegistry()
const store = useMagicPatchBatchStore()
const candidates = computed(() =>
  (registry.catalog.value?.revisions ?? []).filter(
    (revision) =>
      revision.node_api_version === 1 &&
      Boolean(revision.upstream_commit) &&
      groups.some(
        (group) =>
          group.packId === revision.pack_id &&
          group.nodeTypes.some((node) =>
            revision.nodes.includes(typeof node === 'string' ? node : node.type)
          )
      )
  )
)
onMounted(() => registry.load())
</script>
