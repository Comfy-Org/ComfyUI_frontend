<template>
  <div class="extension-panel flex flex-col gap-2">
    <SearchInput
      v-model="searchQuery"
      :clear-label="$t('g.clear')"
      :accessible-label="
        $t('g.searchPlaceholder', { subject: $t('g.extensions') })
      "
      :placeholder="$t('g.searchPlaceholder', { subject: $t('g.extensions') })"
    />
    <Message
      v-if="hasPendingExtensionChanges"
      severity="info"
      class="max-h-96 overflow-y-auto"
    >
      <ul>
        <li v-for="ext in changedExtensions" :key="ext.name">
          <span>
            {{ isExtensionEnabled(ext.name) ? '[-]' : '[+]' }}
          </span>
          {{ ext.name }}
        </li>
        <li v-for="path in changedExtensionPaths" :key="path">
          <span>
            {{ isExtensionPathEnabledAtBoot(path) ? '[-]' : '[+]' }}
          </span>
          {{ extensionNameFromPath(path) }}
        </li>
      </ul>
      <div class="flex justify-end">
        <Button
          variant="destructive"
          :disabled="isSavingExtensionPaths"
          @click="applyChanges"
        >
          {{ $t('g.reloadToApplyChanges') }}
        </Button>
      </div>
    </Message>
    <div class="mb-3 flex gap-2">
      <ToggleGroup v-model="filterType" type="single" :allow-empty="false">
        <ToggleGroupItem
          v-for="option in filterTypes"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    <ExtensionPathTable
      :paths="extensionPaths"
      :enabled-by-path
      :disabled="isSavingExtensionPaths"
      @set-enabled="handleExtensionPathEnabled"
    />
    <ExtensionListTable
      v-model:direction="nameSortDirection"
      :extensions="visibleExtensions"
      :selected-names
      :enabled-by-name
      :select-all-state
      :actions
      @toggle-all="toggleAllVisible"
      @set-selected="setExtensionSelected"
      @set-enabled="(name, enabled) => handleExtensionsEnabled([name], enabled)"
    />
  </div>
</template>

<script setup lang="ts">
import type { CheckboxCheckedState } from 'reka-ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import Message from '@comfyorg/design-system/message/Message'
import SearchInput from '@comfyorg/design-system/search-input/SearchInput'
import {
  filterByQuery,
  sortByText
} from '@comfyorg/design-system/lib/table/tableUtils'
import type { TableSortDirection } from '@comfyorg/design-system/lib/table/tableUtils'
import ToggleGroup from '@comfyorg/design-system/toggle-group/ToggleGroup'
import ToggleGroupItem from '@comfyorg/design-system/toggle-group/ToggleGroupItem'
import { useToast } from '@/components/ui/toast/toastStore'
import type { SettingWriteOutcome } from '@comfyorg/settings-core/settingStore'
import ExtensionListTable from '@/platform/extensions/components/ExtensionListTable.vue'
import ExtensionPathTable from '@/platform/extensions/components/ExtensionPathTable.vue'
import { extensionNameFromPath } from '@/platform/settings/utils/extensionPath'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'

const { t } = useI18n()

const filterTypeKeys = ['all', 'core', 'custom', 'agentCreated'] as const
type FilterTypeKey = (typeof filterTypeKeys)[number]
const filterTypes = computed(() =>
  filterTypeKeys.map((key) => ({
    label: t(`g.${key}`),
    value: key
  }))
)
const filterType = ref<FilterTypeKey>('all')
const selectedNames = ref(new Set<string>())
const searchQuery = ref('')
const nameSortDirection = ref<TableSortDirection | null>(null)

const extensionStore = useExtensionStore()
const {
  agentExtensions,
  changedExtensionPaths,
  changedExtensions,
  enabledByName,
  enabledByPath,
  extensionPaths,
  extensions,
  hasEditableAgentExtensions,
  hasPendingExtensionChanges,
  hasThirdPartyExtensions,
  isSavingExtensionPaths,
  thirdPartyExtensions
} = storeToRefs(extensionStore)
const {
  isCoreExtension,
  isExtensionEnabled,
  isExtensionPathEnabledAtBoot,
  setExtensionPathEnabled,
  setExtensionsEnabled
} = extensionStore
const toast = useToast()

const filteredExtensions = computed(() => {
  switch (filterType.value) {
    case 'core':
      return extensions.value.filter((ext) => isCoreExtension(ext.name))
    case 'custom':
      return thirdPartyExtensions.value
    case 'agentCreated':
      return agentExtensions.value
    default:
      return extensions.value
  }
})

const visibleExtensions = computed(() => {
  const filtered = filterByQuery(
    filteredExtensions.value,
    searchQuery.value,
    (extension) => [extension.name]
  )
  return sortByText(
    filtered,
    nameSortDirection.value,
    (extension) => extension.name
  )
})

const selectAllState = computed<CheckboxCheckedState>(() => {
  const selectedCount = visibleExtensions.value.filter((extension) =>
    selectedNames.value.has(extension.name)
  ).length
  if (selectedCount === 0) return false
  return selectedCount === visibleExtensions.value.length
    ? true
    : 'indeterminate'
})

function setExtensionSelected(name: string, selected: CheckboxCheckedState) {
  const names = new Set(selectedNames.value)
  if (selected === true) names.add(name)
  else names.delete(name)
  selectedNames.value = names
}

function toggleAllVisible(selected: CheckboxCheckedState) {
  selectedNames.value = new Set(
    selected === true
      ? visibleExtensions.value.map((extension) => extension.name)
      : []
  )
}

async function handleExtensionPathEnabled(path: string, enabled: boolean) {
  warnIfUnsaved(await setExtensionPathEnabled(path, enabled))
}

async function handleExtensionsEnabled(
  names: readonly string[],
  enabled: boolean
) {
  warnIfUnsaved(await setExtensionsEnabled(names, enabled))
}

function warnIfUnsaved(status: SettingWriteOutcome['status'] | undefined) {
  switch (status) {
    case 'refused':
      toast.warning(t('g.warning'), {
        description: t('g.extensionPathSaveRefused'),
        duration: 5000
      })
      break
    case 'unconfirmed':
    case 'indeterminate':
      toast.warning(t('g.warning'), {
        description: t('g.extensionPathSaveUnconfirmed'),
        duration: 5000
      })
      break
  }
}

function namesOf(extensionList: readonly { name: string }[]) {
  return extensionList.map((ext) => ext.name)
}

const applyChanges = () => {
  window.location.reload()
}

const actions = computed<MenuItem[]>(() => [
  {
    label: t('g.enableSelected'),
    icon: 'icon-[lucide--check]',
    command: () => handleExtensionsEnabled([...selectedNames.value], true)
  },
  {
    label: t('g.disableSelected'),
    icon: 'icon-[lucide--x]',
    command: () => handleExtensionsEnabled([...selectedNames.value], false)
  },
  {
    separator: true
  },
  {
    label: t('g.enableAll'),
    icon: 'icon-[lucide--check]',
    command: () => handleExtensionsEnabled(namesOf(extensions.value), true)
  },
  {
    label: t('g.disableAll'),
    icon: 'icon-[lucide--x]',
    command: () => handleExtensionsEnabled(namesOf(extensions.value), false)
  },
  {
    label: t('g.disableThirdParty'),
    icon: 'icon-[lucide--x]',
    command: () =>
      handleExtensionsEnabled(namesOf(thirdPartyExtensions.value), false),
    disabled: !hasThirdPartyExtensions.value
  },
  {
    label: t('g.disableAgentCreated'),
    icon: 'icon-[lucide--x]',
    command: () =>
      handleExtensionsEnabled(namesOf(agentExtensions.value), false),
    disabled: !hasEditableAgentExtensions.value
  }
])
</script>
