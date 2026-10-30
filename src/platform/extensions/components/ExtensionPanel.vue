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
    <Message v-if="hasChanges" severity="info" class="max-h-96 overflow-y-auto">
      <ul>
        <li v-for="ext in changedExtensions" :key="ext.name">
          <span>
            {{ extensionStore.isExtensionEnabled(ext.name) ? '[-]' : '[+]' }}
          </span>
          {{ ext.name }}
        </li>
        <li v-for="path in changedExtensionPaths" :key="path">
          <span>
            {{
              extensionStore.isExtensionPathEnabledAtBoot(path) ? '[-]' : '[+]'
            }}
          </span>
          {{ extensionNameFromPath(path) }}
        </li>
      </ul>
      <div class="flex justify-end">
        <Button
          variant="destructive"
          :disabled="extensionStore.isSavingExtensionPaths"
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
      :paths="extensionStore.extensionPaths"
      :enabled-by-path
      :disabled="extensionStore.isSavingExtensionPaths"
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
      @set-enabled="setExtensionEnabled"
    />
  </div>
</template>

<script setup lang="ts">
import type { CheckboxCheckedState } from 'reka-ui'
import { computed, ref, watch } from 'vue'
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
import ExtensionListTable from '@/platform/extensions/components/ExtensionListTable.vue'
import ExtensionPathTable from '@/platform/extensions/components/ExtensionPathTable.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
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
const settingStore = useSettingStore()
const toast = useToast()

const enabledByName = ref<Record<string, boolean>>({})

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

watch(
  () => extensionStore.extensions,
  (extensions) => {
    extensions.forEach((ext) => {
      if (ext.name in enabledByName.value) return
      enabledByName.value[ext.name] = extensionStore.isExtensionEnabled(
        ext.name
      )
    })
  },
  { immediate: true }
)

const enabledByPath = computed(() => {
  const disabledPaths = new Set(
    extensionStore.getCurrentDisabledExtensionPaths()
  )
  return Object.fromEntries(
    extensionStore.extensionPaths.map((path) => [
      path,
      !disabledPaths.has(path)
    ])
  )
})

const changedExtensions = computed(() => {
  return extensionStore.extensions.filter(
    (ext) =>
      enabledByName.value[ext.name] !==
      extensionStore.isExtensionEnabled(ext.name)
  )
})

const changedExtensionPaths = computed(() => {
  return extensionStore.extensionPaths.filter(
    (path) =>
      enabledByPath.value[path] !==
      extensionStore.isExtensionPathEnabledAtBoot(path)
  )
})

const hasChanges = computed(() => {
  return (
    changedExtensions.value.length > 0 || changedExtensionPaths.value.length > 0
  )
})

const updateExtensionStatus = async () => {
  const editingDisabledExtensionNames = Object.entries(enabledByName.value)
    .filter(([_, enabled]) => !enabled)
    .map(([name]) => name)

  await settingStore.set('Comfy.Extension.Disabled', [
    ...extensionStore.inactiveDisabledExtensionNames,
    ...editingDisabledExtensionNames
  ])
}

async function setExtensionEnabled(name: string, enabled: boolean) {
  enabledByName.value[name] = enabled
  await updateExtensionStatus()
}

async function handleExtensionPathEnabled(path: string, enabled: boolean) {
  const result = await extensionStore.setExtensionPathEnabled(path, enabled)
  if (result === 'refused') {
    toast.warning(t('g.warning'), {
      description: t('g.extensionPathSaveRefused'),
      duration: 5000
    })
  } else if (result === 'unconfirmed') {
    toast.warning(t('g.warning'), {
      description: t('g.extensionPathSaveUnconfirmed'),
      duration: 5000
    })
  }
}

const enableAllExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isExtensionReadOnly(ext.name)) return

    enabledByName.value[ext.name] = true
  })
  await updateExtensionStatus()
}

const disableAllExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isExtensionReadOnly(ext.name)) return

    enabledByName.value[ext.name] = false
  })
  await updateExtensionStatus()
}

const disableThirdPartyExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isCoreExtension(ext.name)) return

    enabledByName.value[ext.name] = false
  })
  await updateExtensionStatus()
}

async function disableAgentExtensions() {
  extensionStore.agentExtensions.forEach((ext) => {
    if (extensionStore.isExtensionReadOnly(ext.name)) return

    enabledByName.value[ext.name] = false
  })
  await updateExtensionStatus()
}

const applyChanges = () => {
  const url = new URL(window.location.href)
  url.searchParams.delete('safe')
  window.history.replaceState(window.history.state, '', url)
  window.location.reload()
}

const actions = computed<MenuItem[]>(() => [
  {
    label: t('g.enableSelected'),
    icon: 'icon-[lucide--check]',
    command: async () => {
      selectedNames.value.forEach((name) => {
        if (!extensionStore.isExtensionReadOnly(name)) {
          enabledByName.value[name] = true
        }
      })
      await updateExtensionStatus()
    }
  },
  {
    label: t('g.disableSelected'),
    icon: 'icon-[lucide--x]',
    command: async () => {
      selectedNames.value.forEach((name) => {
        if (!extensionStore.isExtensionReadOnly(name)) {
          enabledByName.value[name] = false
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
    icon: 'icon-[lucide--check]',
    command: enableAllExtensions
  },
  {
    label: t('g.disableAll'),
    icon: 'icon-[lucide--x]',
    command: disableAllExtensions
  },
  {
    label: t('g.disableThirdParty'),
    icon: 'icon-[lucide--x]',
    command: disableThirdPartyExtensions,
    disabled: !extensionStore.hasThirdPartyExtensions
  },
  {
    label: t('g.disableAgentCreated'),
    icon: 'icon-[lucide--x]',
    command: disableAgentExtensions,
    disabled: !extensionStore.agentExtensions.some(
      (extension) => !extensionStore.isExtensionReadOnly(extension.name)
    )
  }
])
</script>
