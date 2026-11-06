<template>
  <div class="flex flex-wrap items-center gap-2">
    <SearchInput
      v-model="draftQuery"
      :placeholder="$t('buildCustomNodes.picker.search')"
      :accessible-label="$t('buildCustomNodes.picker.search')"
      :clear-label="$t('buildCustomNodes.picker.clearSearch')"
      class="max-w-96 min-w-60 flex-1"
      @search="query = $event.trim()"
    />
    <NodePackToolbarMenu
      icon="icon-[lucide--list-filter]"
      :text="statusText"
      :label="
        $t('buildCustomNodes.picker.statusMenuLabel', { value: statusText })
      "
      :heading="$t('buildCustomNodes.picker.status.heading')"
    >
      <NodePackRadioMenu
        v-model="status"
        :label="$t('buildCustomNodes.picker.status.heading')"
        :options="statusOptions"
      />
    </NodePackToolbarMenu>
    <NodePackToolbarMenu
      icon="icon-[lucide--scale]"
      :text="licenseText"
      :label="
        $t('buildCustomNodes.picker.licenseMenuLabel', { value: licenseText })
      "
      :heading="$t('buildCustomNodes.picker.license.heading')"
    >
      <NodePackLicenseMenu v-model="licenses" :licenses="licenseChoices" />
    </NodePackToolbarMenu>
    <NodePackToolbarMenu
      icon="icon-[lucide--arrow-up-down]"
      :text="sortText"
      :label="$t('buildCustomNodes.picker.sortMenuLabel', { value: sortText })"
      :heading="$t('buildCustomNodes.picker.sort.heading')"
    >
      <NodePackRadioMenu
        v-model="sort"
        :label="$t('buildCustomNodes.picker.sort.heading')"
        :options="sortOptions"
      />
    </NodePackToolbarMenu>
  </div>
</template>

<script setup lang="ts">
import SearchInput from '@comfyorg/design-system/search-input/SearchInput'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NodePackLicenseMenu from '@/platform/workspace/buildCustomNodes/components/NodePackLicenseMenu.vue'
import NodePackRadioMenu from '@/platform/workspace/buildCustomNodes/components/NodePackRadioMenu.vue'
import NodePackToolbarMenu from '@/platform/workspace/buildCustomNodes/components/NodePackToolbarMenu.vue'
import type {
  NodePackSort,
  NodePackStatusFilter
} from '@/platform/workspace/buildCustomNodes/nodePackTable'
import {
  NODE_PACK_SORTS,
  NODE_PACK_STATUS_FILTERS,
  UNLISTED_LICENSE
} from '@/platform/workspace/buildCustomNodes/nodePackTable'

const { licenseChoices } = defineProps<{
  licenseChoices: readonly string[]
}>()

const query = defineModel<string>('query', { required: true })
const status = defineModel<NodePackStatusFilter>('status', { required: true })
const licenses = defineModel<ReadonlySet<string>>('licenses', {
  required: true
})
const sort = defineModel<NodePackSort>('sort', { required: true })

const { t } = useI18n()
const draftQuery = ref(query.value)

const statusOptions = computed(() =>
  NODE_PACK_STATUS_FILTERS.map((value) => ({
    value,
    label: t(`buildCustomNodes.picker.status.${value}`)
  }))
)
const sortOptions = computed(() =>
  NODE_PACK_SORTS.map((value) => ({
    value,
    label: t(`buildCustomNodes.picker.sort.${value}`)
  }))
)
const statusText = computed(() =>
  t(`buildCustomNodes.picker.status.${status.value}`)
)
const sortText = computed(() => t(`buildCustomNodes.picker.sort.${sort.value}`))
const licenseText = computed(() => {
  const [only] = licenses.value
  if (licenses.value.size === 0) return t('buildCustomNodes.picker.license.any')
  if (licenses.value.size > 1)
    return t('buildCustomNodes.picker.license.count', licenses.value.size)
  return only === UNLISTED_LICENSE
    ? t('buildCustomNodes.picker.license.unlisted')
    : only
})
</script>
