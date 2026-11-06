<template>
  <div class="flex flex-col gap-5 p-6">
    <div class="flex flex-col gap-1.5 pr-8">
      <DialogTitle class="my-0 text-lg">
        {{ $t('buildCustomNodes.picker.title', { build: buildName }) }}
      </DialogTitle>
      <p class="m-0 text-sm text-muted-foreground">
        {{
          $t('buildCustomNodes.picker.body', {
            build: buildName,
            deployment: session.deploymentName
          })
        }}
      </p>
    </div>
    <SearchInput
      v-model="draftQuery"
      :placeholder="$t('buildCustomNodes.picker.search')"
      :accessible-label="$t('buildCustomNodes.picker.search')"
      :clear-label="$t('buildCustomNodes.picker.clearSearch')"
      :loading="status === 'loading'"
      class="max-w-96"
      @search="search"
    />
    <div class="flex flex-col gap-2">
      <NodePackTable
        :rows
        :status
        :query
        @toggle="(pack, choice) => emit('toggle', pack, choice)"
        @choose="(pack, choice) => emit('choose', pack, choice)"
        @retry="retry"
      />
      <div class="flex items-center justify-between gap-3 text-sm">
        <span>
          {{
            $t(
              'buildCustomNodes.picker.inBuildCount',
              { count: buildCount, build: buildName },
              buildCount
            )
          }}
          <span class="text-muted-foreground">
            {{ $t('buildCustomNodes.picker.pickedCount', pickCount) }}
          </span>
        </span>
        <span class="flex items-center gap-2">
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="$t('buildCustomNodes.picker.previousPage')"
            :disabled="page === 0"
            @click="page--"
          >
            <i class="icon-[lucide--chevron-left]" aria-hidden="true" />
          </Button>
          <span class="text-muted-foreground tabular-nums">
            {{ $t('buildCustomNodes.picker.page', { page: page + 1 }) }}
          </span>
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="$t('buildCustomNodes.picker.nextPage')"
            :disabled="!hasMore"
            @click="page++"
          >
            <i class="icon-[lucide--chevron-right]" aria-hidden="true" />
          </Button>
        </span>
      </div>
    </div>
    <div class="flex items-center justify-end gap-2">
      <CustomNodesDocsLink class="mr-auto" />
      <Button variant="secondary" size="lg" @click="emit('cancel')">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="inverted"
        size="lg"
        :disabled="pickCount === 0"
        @click="emit('review')"
      >
        {{ $t('buildCustomNodes.picker.review', pickCount) }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import SearchInput from '@comfyorg/design-system/search-input/SearchInput'
import { computed, ref } from 'vue'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import CustomNodesDocsLink from '@/platform/workspace/buildCustomNodes/components/CustomNodesDocsLink.vue'
import NodePackTable from '@/platform/workspace/buildCustomNodes/components/NodePackTable.vue'
import type { NodePackVersionChoice } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import { useNodePackRows } from '@/platform/workspace/buildCustomNodes/useNodePackRows'

const { session } = defineProps<{
  session: BuildSession
}>()

const emit = defineEmits<{
  toggle: [pack: NodePack, choice: NodePackVersionChoice]
  choose: [pack: NodePack, choice: NodePackVersionChoice]
  review: []
  cancel: []
}>()

const draftQuery = ref('')
const query = ref('')
const page = ref(0)

const { rows, status, hasMore, retry } = useNodePackRows(
  () => session,
  query,
  page
)

const buildName = computed(() => session.build.build.name)
const buildCount = computed(() => session.build.build.custom_nodes.length)
const pickCount = computed(() => session.picks.length)

function search(value: string) {
  query.value = value.trim()
  page.value = 0
}
</script>
