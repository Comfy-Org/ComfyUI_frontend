<script setup lang="ts">
import { computed } from 'vue'

import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { RemoteComboConfig } from '@/schemas/nodeDefSchema'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import RemoteComboContent from './RemoteCombo/Content.vue'
import RemoteComboEmpty from './RemoteCombo/Empty.vue'
import RemoteComboError from './RemoteCombo/Error.vue'
import RemoteComboItem from './RemoteCombo/Item.vue'
import RemoteComboList from './RemoteCombo/List.vue'
import RemoteComboLoading from './RemoteCombo/Loading.vue'
import RemoteComboRefresh from './RemoteCombo/Refresh.vue'
import RemoteComboRoot from './RemoteCombo/Root.vue'
import RemoteComboSearch from './RemoteCombo/Search.vue'
import RemoteComboTrigger from './RemoteCombo/Trigger.vue'
import type { RemoteComboContext } from './RemoteCombo/state'
import { useRemoteCombo } from '../composables/useRemoteCombo'

const { widget } = defineProps<{
  widget: SimplifiedWidget<string | undefined>
}>()

const modelValue = defineModel<string | undefined>()

const comboSpec = computed(() => {
  if (widget.spec && isComboInputSpec(widget.spec)) {
    return widget.spec
  }
  return undefined
})

const remoteConfig = computed<RemoteComboConfig | undefined>(
  () => comboSpec.value?.remote_combo
)

const fieldLabel = computed(() => widget.label ?? widget.name)

const combo = useRemoteCombo({
  config: remoteConfig,
  modelValue,
  fieldLabel
})

const context: RemoteComboContext = {
  isOpen: combo.isOpen,
  searchQuery: combo.searchQuery,
  selectedValue: combo.selectedValue,
  items: combo.items,
  filteredItems: combo.filteredItems,
  isLoading: combo.isLoading,
  isFetching: combo.isFetching,
  errorMessage: combo.errorMessage,
  refresh: combo.refresh,
  select: combo.select,
  fieldLabel: combo.fieldLabel,
  previewType: combo.previewType
}

const showRefreshButton = computed(
  () => !!remoteConfig.value && remoteConfig.value.refresh_button !== false
)

const isDisabled = computed(() => widget.options?.disabled === true)
</script>

<template>
  <div
    class="flex w-full min-w-0 items-center gap-1"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <RemoteComboRoot
      :context="context"
      :disabled="isDisabled"
      class="min-w-0 flex-1"
    >
      <RemoteComboTrigger :disabled="isDisabled" class="min-w-0 flex-1" />
      <RemoteComboContent>
        <RemoteComboSearch />
        <RemoteComboLoading v-if="combo.isLoading.value" />
        <RemoteComboError v-else-if="combo.errorMessage.value" />
        <RemoteComboList v-else>
          <RemoteComboItem
            v-for="(item, index) in combo.filteredItems.value"
            :key="item.id"
            :item
            :index
          />
          <RemoteComboEmpty v-if="combo.filteredItems.value.length === 0" />
        </RemoteComboList>
      </RemoteComboContent>
    </RemoteComboRoot>
    <RemoteComboRefresh
      v-if="showRefreshButton"
      :context="context"
      :disabled="isDisabled"
    />
  </div>
</template>
