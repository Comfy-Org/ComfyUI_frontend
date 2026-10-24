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
            {{
              extensionStore.wasExtensionPackEnabledAtBoot(pack) ? '[-]' : '[+]'
            }}
          </span>
          {{ extensionPackName(pack) }}
        </li>
      </ul>
      <div class="flex justify-end">
        <Button
          variant="destructive"
          :disabled="extensionStore.isSavingExtensionPacks"
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
    <ExtensionPackTable
      :packs="extensionStore.extensionPackPaths"
      :enabled-by-path="enabledExtensionPacks"
      :saving="extensionStore.isSavingExtensionPacks"
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
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Message from '@/components/ui/message/Message.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { filterByQuery, sortByText } from '@/components/ui/table/tableUtils'
import type { TableSortDirection } from '@/components/ui/table/tableUtils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  agentExtensionFilterRequest,
  consumeAgentExtensionFilterRequest,
  getAgentExtensionDisableSettings
} from '@/platform/settings/agentExtensionService'
import type { ExtensionFilterType } from '@/platform/settings/agentExtensionService'
import ExtensionListTable from '@/platform/settings/components/ExtensionListTable.vue'
import ExtensionPackTable from '@/platform/settings/components/ExtensionPackTable.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { extensionPackName, useExtensionStore } from '@/stores/extensionStore'

const { t } = useI18n()

const filterTypes = computed(
  () =>
    [
      { label: t('g.all'), value: 'all' },
      { label: t('g.core'), value: 'core' },
      { label: t('g.custom'), value: 'custom' },
      { label: t('g.agentCreated'), value: 'agentCreated' }
    ] satisfies { label: string; value: ExtensionFilterType }[]
)
const filterType = ref<ExtensionFilterType>('all')
const selectedExtensionNames = ref(new Set<string>())
const searchQuery = ref('')
const nameSortDirection = ref<TableSortDirection | null>(null)

const extensionStore = useExtensionStore()
const settingStore = useSettingStore()
watch(
  agentExtensionFilterRequest,
  (requestedFilter) => {
    if (!requestedFilter) return
    filterType.value = requestedFilter
    consumeAgentExtensionFilterRequest(requestedFilter)
  },
  { immediate: true }
)

const editingEnabledExtensions = ref<Record<string, boolean>>({})

const enabledExtensionPacks = computed(() =>
  Object.fromEntries(
    extensionStore.extensionPackPaths.map((path) => [
      path,
      extensionStore.isExtensionPackEnabled(path)
    ])
  )
)

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
    case 'agentCreated':
      return extensionStore.agentExtensions
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
})

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
      extensionStore.isExtensionPackEnabled(path) !==
      extensionStore.wasExtensionPackEnabledAtBoot(path)
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
  const result = await extensionStore.setExtensionPackEnabled(path, enabled)
  if (result.ok) return

  useToast().warning(
    t('toastMessages.errorSaveSetting', {
      id: 'Comfy.Extension.DisabledPacks',
      err: result.detail
    })
  )
  reportError(result.detail, {
    errorType: 'failure_saving_extension_pack',
    surface: 'platform',
    level: 'warning',
    tags: { reason: result.reason },
    context: { path, enabled }
  })
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

const disableAgentExtensions = async () => {
  const settings = getAgentExtensionDisableSettings(
    extensionStore.agentExtensions
  )
  await settingStore.setMany(settings)
  editingEnabledExtensions.value = Object.fromEntries(
    Object.entries(editingEnabledExtensions.value).map(([name, enabled]) => [
      name,
      settings['Comfy.Extension.Disabled'].includes(name) ? false : enabled
    ])
  )
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
  },
  {
    label: t('g.disableAgentCreated'),
    icon: 'pi pi-times',
    command: disableAgentExtensions,
    disabled: !extensionStore.hasAgentExtensions
  }
])
</script>
