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
    <NodePackToolbar
      :query="view.query"
      :status="view.status"
      :licenses="view.licenses"
      :sort="view.sort"
      :license-choices="licenseChoices"
      @update:query="setView({ query: $event })"
      @update:status="setView({ status: $event })"
      @update:licenses="setView({ licenses: $event })"
      @update:sort="setView({ sort: $event })"
    />
    <div class="flex flex-col gap-2">
      <NodePackTable
        :rows
        :status="searchStatus"
        :query="view.query"
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
            {{
              $t('buildCustomNodes.picker.pageOf', {
                page: page + 1,
                count: pageCount
              })
            }}
          </span>
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="$t('buildCustomNodes.picker.nextPage')"
            :disabled="page + 1 >= pageCount"
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
        variant="secondary"
        size="lg"
        as="a"
        :href="editOnPlatformUrl"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="
          $t('buildCustomNodes.picker.editOnPlatformLabel', {
            build: buildName
          })
        "
      >
        {{ $t('buildCustomNodes.picker.editOnPlatform') }}
        <i
          class="icon-[lucide--square-arrow-out-up-right]"
          aria-hidden="true"
        />
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
import { computed, ref, shallowRef } from 'vue'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import CustomNodesDocsLink from '@/platform/workspace/buildCustomNodes/components/CustomNodesDocsLink.vue'
import NodePackTable from '@/platform/workspace/buildCustomNodes/components/NodePackTable.vue'
import NodePackToolbar from '@/platform/workspace/buildCustomNodes/components/NodePackToolbar.vue'
import type { NodePackVersionChoice } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import type { NodePackView } from '@/platform/workspace/buildCustomNodes/useNodePackRows'
import { useNodePackRows } from '@/platform/workspace/buildCustomNodes/useNodePackRows'
import { platformLink } from '@/platform/workspace/utils/platformLink'

const { session } = defineProps<{
  session: BuildSession
}>()

const emit = defineEmits<{
  toggle: [pack: NodePack, choice: NodePackVersionChoice]
  choose: [pack: NodePack, choice: NodePackVersionChoice]
  review: []
  cancel: []
}>()

const view = shallowRef<NodePackView>({
  query: '',
  status: 'all',
  licenses: new Set(),
  sort: 'installs'
})
const page = ref(0)

function setView(change: Partial<NodePackView>) {
  view.value = { ...view.value, ...change }
  page.value = 0
}

const {
  rows,
  status: searchStatus,
  pageCount,
  licenses: licenseChoices,
  retry
} = useNodePackRows(
  () => session,
  () => view.value,
  page
)

const buildName = computed(() => session.build.build.name)
const buildCount = computed(() => session.build.build.custom_nodes.length)
const pickCount = computed(() => session.picks.length)
const editOnPlatformUrl = computed(() =>
  platformLink(
    `/profile/builds/new?edit=${encodeURIComponent(session.build.build.build_id)}&step=nodes`
  )
)
</script>
