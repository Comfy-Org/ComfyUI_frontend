<template>
  <div class="flex flex-col gap-4 p-6">
    <header class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="m-0 text-lg font-medium">
          {{ $t('customNodePacks.registry.title') }}
        </h2>
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('customNodePacks.registry.description') }}
        </p>
      </div>
      <Button
        variant="secondary"
        size="icon"
        :aria-label="$t('customNodePacks.close')"
        @click="onClose?.()"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </header>
    <SearchInput
      v-model="query"
      :placeholder="$t('customNodePacks.registry.search')"
      :aria-label="$t('customNodePacks.registry.search')"
      :debounce-time="0"
    />
    <p v-if="catalog" class="m-0 text-xs text-muted-foreground">
      {{
        $t('customNodePacks.registry.corpus', {
          count: catalog.revisions.length,
          commit: catalog.corpus_commit.slice(0, 12)
        })
      }}
    </p>
    <p
      v-if="state.phase === 'error'"
      role="alert"
      class="m-0 text-sm text-muted-foreground"
    >
      {{ $t('customNodePacks.registry.failed') }}
      {{
        $t(`customNodePacks.registry.errors.${state.failure.reason}`, {
          status:
            state.failure.reason === 'http' ? state.failure.status : undefined
        })
      }}
    </p>
    <div v-if="!catalog && busy" role="status" class="text-sm">
      {{ $t('customNodePacks.loading') }}
    </div>
    <ul class="m-0 flex max-h-96 list-none flex-col gap-2 overflow-y-auto p-0">
      <li
        v-for="revision in visibleRevisions"
        :key="revision.revision_id"
        class="flex flex-col gap-2 rounded-lg border border-border-default px-3 py-2"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <span class="truncate text-sm font-medium">{{
              revision.name
            }}</span>
            <span class="text-xs text-muted-foreground">
              {{
                $t('customNodePacks.registry.revision', {
                  commit: revision.upstream_commit
                    ? revision.upstream_commit.slice(0, 12)
                    : $t('customNodePacks.registry.provenanceMissing'),
                  digest: revision.revision_id.slice(0, 12)
                })
              }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{
                revision.prepared
                  ? $t('customNodePacks.registry.prepared')
                  : $t('customNodePacks.registry.pending')
              }}
            </span>
          </div>
          <Button
            variant="secondary"
            :disabled="
              busy || state.phase === 'error' || !revision.upstream_commit
            "
            :loading="
              state.phase === 'saving' &&
              state.revisionId === revision.revision_id
            "
            :aria-label="
              $t(
                revision.pinned
                  ? 'customNodePacks.registry.unpinNamed'
                  : 'customNodePacks.registry.pinNamed',
                { name: revision.name }
              )
            "
            @click="setPin(revision.revision_id, !revision.pinned)"
          >
            {{
              revision.pinned
                ? $t('customNodePacks.registry.unpin')
                : $t('customNodePacks.registry.pin')
            }}
          </Button>
        </div>
        <details class="text-xs text-muted-foreground">
          <summary class="cursor-pointer">
            {{
              $t('customNodePacks.registry.nodes', {
                count: revision.nodes.length
              })
            }}
          </summary>
          <ul class="my-2 flex list-none flex-col gap-1 p-0">
            <li v-for="node in revision.nodes" :key="node">{{ node }}</li>
          </ul>
          <p class="break-all">{{ revision.revision_id }}</p>
        </details>
      </li>
    </ul>
    <p v-if="catalog && !visibleRevisions.length" class="m-0 text-sm">
      {{ $t('customNodePacks.registry.noMatches') }}
    </p>
    <p class="m-0 text-xs text-muted-foreground">
      {{ $t('customNodePacks.registry.qualification') }}
    </p>
    <Button variant="secondary" :disabled="busy" @click="load">
      {{ $t('customNodePacks.registry.refresh') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { useCloudNodeRegistry } from '@/platform/customNodes/composables/useCloudNodeRegistry'

const { onClose } = defineProps<{ onClose?: () => void }>()
const { state, catalog, busy, load, setPin } = useCloudNodeRegistry()
const query = ref('')
const visibleRevisions = computed(() => {
  const term = query.value.trim().toLowerCase()
  return (catalog.value?.revisions ?? []).filter(
    (revision) =>
      !term ||
      revision.name.toLowerCase().includes(term) ||
      revision.nodes.some((node) => node.toLowerCase().includes(term))
  )
})

onMounted(() => void load())
</script>
