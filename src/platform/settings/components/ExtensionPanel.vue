<template>
  <div class="extension-panel flex flex-col gap-2">
    <SearchInput
      v-model="searchQuery"
      :clear-label="$t('g.clear')"
      :accessible-label="$t('g.search')"
      :placeholder="$t('g.searchPlaceholder', { subject: $t('g.extensions') })"
    />
    <Message v-if="hasChanges" severity="info" class="max-h-96 overflow-y-auto">
      <ul>
        <li v-for="ext in changedExtensions" :key="ext.name">
          <span>
            {{ extensionStore.isExtensionEnabled(ext.name) ? '[-]' : '[+]' }}
          </span>
          {{ ext.name }}
        </li>
        <li v-for="pack in changedExtensionPacks" :key="pack">
          <span>
            {{ editingEnabledExtensionPacks[pack] ? '[-]' : '[+]' }}
          </span>
          {{ extensionPackName(pack) }}
        </li>
      </ul>
      <div class="flex justify-end">
        <Button variant="destructive" @click="applyChanges">
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
    <ExtensionPackTable
      :packs="extensionStore.extensionPackPaths"
      :enabled-by-path="editingEnabledExtensionPacks"
      @set-enabled="setExtensionPackEnabled"
    />
    <ExtensionListTable
      v-model:direction="nameSortDirection"
      :extensions="visibleExtensions"
      :selected-names="selectedExtensionNames"
      :enabled-by-name="editingEnabledExtensions"
      :select-all-state="selectAllState"
      :actions="extensionActions"
      @toggle-all="toggleAllVisible"
      @set-selected="setExtensionSelected"
      @set-enabled="setExtensionEnabled"
    />
  </div>
</template>

<script setup lang="ts">
import type { CheckboxCheckedState } from 'reka-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Message from '@/components/ui/message/Message.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { filterByQuery, sortByText } from '@/components/ui/table/tableUtils'
import type { TableSortDirection } from '@/components/ui/table/tableUtils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import ExtensionListTable from '@/platform/settings/components/ExtensionListTable.vue'
import ExtensionPackTable from '@/platform/settings/components/ExtensionPackTable.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'

const { t } = useI18n()

const filterTypeKeys = ['all', 'core', 'custom'] as const
type FilterTypeKey = (typeof filterTypeKeys)[number]
const filterTypes = computed(() =>
  filterTypeKeys.map((key) => ({
    label: t(`g.${key}`),
    value: key
  }))
)
const filterType = ref<FilterTypeKey>('all')
const selectedExtensionNames = ref(new Set<string>())
const searchQuery = ref('')
const nameSortDirection = ref<TableSortDirection | null>(null)

const extensionStore = useExtensionStore()
const settingStore = useSettingStore()

const editingEnabledExtensions = ref<Record<string, boolean>>({})
const editingEnabledExtensionPacks = ref<Record<string, boolean>>({})

const filteredExtensions = computed(() => {
  const extensions = extensionStore.extensions
  switch (filterType.value) {
    case 'core':
      return extensions.filter((ext) =>
        extensionStore.isCoreExtension(ext.name)
      )
    case 'custom':
      return extensions.filter(
        (ext) => !extensionStore.isCoreExtension(ext.name)
      )
    default:
      return extensions
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
    selectedExtensionNames.value.has(extension.name)
  ).length
  if (selectedCount === 0) return false
  return selectedCount === visibleExtensions.value.length
    ? true
    : 'indeterminate'
})

function setExtensionSelected(name: string, selected: CheckboxCheckedState) {
  const names = new Set(selectedExtensionNames.value)
  if (selected === true) names.add(name)
  else names.delete(name)
  selectedExtensionNames.value = names
}

function toggleAllVisible(selected: CheckboxCheckedState) {
  selectedExtensionNames.value = new Set(
    selected === true
      ? visibleExtensions.value.map((extension) => extension.name)
      : []
  )
}

onMounted(() => {
  extensionStore.extensions.forEach((ext) => {
    editingEnabledExtensions.value[ext.name] =
      extensionStore.isExtensionEnabled(ext.name)
  })
  extensionStore.extensionPackPaths.forEach((path) => {
    editingEnabledExtensionPacks.value[path] =
      extensionStore.isExtensionPackEnabled(path)
  })
})

function extensionPackName(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

const changedExtensions = computed(() => {
  return extensionStore.extensions.filter(
    (ext) =>
      editingEnabledExtensions.value[ext.name] !==
      extensionStore.isExtensionEnabled(ext.name)
  )
})

const changedExtensionPacks = computed(() => {
  return extensionStore.extensionPackPaths.filter(
    (path) =>
      editingEnabledExtensionPacks.value[path] !==
      extensionStore.isExtensionPackEnabled(path)
  )
})

const hasChanges = computed(() => {
  return (
    changedExtensions.value.length > 0 || changedExtensionPacks.value.length > 0
  )
})

const updateExtensionStatus = async () => {
  const editingDisabledExtensionNames = Object.entries(
    editingEnabledExtensions.value
  )
    .filter(([_, enabled]) => !enabled)
    .map(([name]) => name)

  await settingStore.set('Comfy.Extension.Disabled', [
    ...extensionStore.inactiveDisabledExtensionNames,
    ...editingDisabledExtensionNames
  ])
}

async function setExtensionEnabled(name: string, enabled: boolean) {
  editingEnabledExtensions.value[name] = enabled
  await updateExtensionStatus()
}

async function setExtensionPackEnabled(path: string, enabled: boolean) {
  editingEnabledExtensionPacks.value[path] = enabled
  const editingDisabledExtensionPackPaths = Object.entries(
    editingEnabledExtensionPacks.value
  )
    .filter(([_, isEnabled]) => !isEnabled)
    .map(([packPath]) => packPath)

  await settingStore.set('Comfy.Extension.DisabledPacks', [
    ...extensionStore.inactiveDisabledExtensionPackPaths,
    ...editingDisabledExtensionPackPaths
  ])
}

const enableAllExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isExtensionReadOnly(ext.name)) return

    editingEnabledExtensions.value[ext.name] = true
  })
  await updateExtensionStatus()
}

const disableAllExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isExtensionReadOnly(ext.name)) return

    editingEnabledExtensions.value[ext.name] = false
  })
  await updateExtensionStatus()
}

const disableThirdPartyExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isCoreExtension(ext.name)) return

    editingEnabledExtensions.value[ext.name] = false
  })
  await updateExtensionStatus()
}

const applyChanges = () => {
  // Refresh the page to apply changes
  window.location.reload()
}

const extensionActions = computed<MenuItem[]>(() => [
  {
    label: t('g.enableSelected'),
    icon: 'pi pi-check',
    command: async () => {
      selectedExtensionNames.value.forEach((name) => {
        if (!extensionStore.isExtensionReadOnly(name)) {
          editingEnabledExtensions.value[name] = true
        }
      })
      await updateExtensionStatus()
    }
  },
  {
    label: t('g.disableSelected'),
    icon: 'pi pi-times',
    command: async () => {
      selectedExtensionNames.value.forEach((name) => {
        if (!extensionStore.isExtensionReadOnly(name)) {
          editingEnabledExtensions.value[name] = false
        }
      })
      await updateExtensionStatus()
    }
  },
  {
    separator: true
  },
  {
    label: t('g.enableAll'),
    icon: 'pi pi-check',
    command: enableAllExtensions
  },
  {
    label: t('g.disableAll'),
    icon: 'pi pi-times',
    command: disableAllExtensions
  },
  {
    label: t('g.disableThirdParty'),
    icon: 'pi pi-times',
    command: disableThirdPartyExtensions,
    disabled: !extensionStore.hasThirdPartyExtensions
  }
])
</script>
