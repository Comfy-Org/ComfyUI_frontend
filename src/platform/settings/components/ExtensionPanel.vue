<template>
  <div class="extension-panel flex flex-col gap-2">
    <SearchInput
      v-model="searchQuery"
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
      </ul>
      <div class="flex justify-end">
        <Button variant="destructive" @click="applyChanges">
          {{ $t('g.reloadToApplyChanges') }}
        </Button>
      </div>
    </Message>
    <div class="mb-3 flex gap-2">
      <ToggleGroup v-model="filterType" type="single">
        <ToggleGroupItem
          v-for="option in filterTypes"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    <Table class="rounded-lg border border-border-default">
      <TableHeader>
        <TableRow>
          <TableHead class="w-12">
            <Checkbox
              :model-value="allVisibleSelected"
              :aria-label="$t('g.selectAll')"
              @update:model-value="toggleAllVisible"
            />
          </TableHead>
          <TableHead>
            <button
              type="button"
              class="flex items-center gap-1 hover:text-base-foreground"
              @click="toggleNameSort"
            >
              {{ $t('g.extensionName') }}
              <i
                :class="
                  nameSortDirection === 'ascending'
                    ? 'icon-[lucide--arrow-up]'
                    : 'icon-[lucide--arrow-down]'
                "
                class="size-4"
              />
            </button>
          </TableHead>
          <TableHead class="w-20 text-right">
            <Button
              size="icon"
              variant="muted-textonly"
              :aria-label="$t('g.moreOptions')"
              @click="menu?.show($event)"
            >
              <i class="icon-[lucide--ellipsis]" />
            </Button>
            <Menu ref="menu" :model="contextMenuItems" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="extension in visibleExtensions" :key="extension.name">
          <TableCell>
            <Checkbox
              :model-value="selectedExtensionNames.has(extension.name)"
              :aria-label="extension.name"
              @update:model-value="
                (selected) => setExtensionSelected(extension, selected)
              "
            />
          </TableCell>
          <TableCell>
            {{ extension.name }}
            <Tag
              v-if="extensionStore.isCoreExtension(extension.name)"
              :value="$t('g.core')"
            />
            <Tag v-else :value="$t('g.custom')" severity="info" />
          </TableCell>
          <TableCell class="text-right">
            <Switch
              :model-value="editingEnabledExtensions[extension.name]"
              :disabled="extensionStore.isExtensionReadOnly(extension.name)"
              :aria-label="extension.name"
              @update:model-value="
                (enabled) => setExtensionEnabled(extension.name, enabled)
              "
            />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import Tag from '@/components/ui/badge/Badge.vue'
import Message from '@/components/ui/message/Message.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { filterByQuery, sortByText } from '@/components/ui/table/tableUtils'
import type { TableSortDirection } from '@/components/ui/table/tableUtils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

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
const selectedExtensions = ref<ComfyExtension[]>([])
const searchQuery = ref('')
const nameSortDirection = ref<TableSortDirection>('ascending')

const extensionStore = useExtensionStore()
const settingStore = useSettingStore()

const editingEnabledExtensions = ref<Record<string, boolean>>({})

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
    (extension) => extension.name
  )
  return sortByText(
    filtered,
    nameSortDirection.value,
    (extension) => extension.name
  )
})

const selectedExtensionNames = computed(
  () => new Set(selectedExtensions.value.map((extension) => extension.name))
)

const allVisibleSelected = computed(
  () =>
    visibleExtensions.value.length > 0 &&
    visibleExtensions.value.every((extension) =>
      selectedExtensionNames.value.has(extension.name)
    )
)

function toggleNameSort() {
  nameSortDirection.value =
    nameSortDirection.value === 'ascending' ? 'descending' : 'ascending'
}

function setExtensionSelected(extension: ComfyExtension, selected: boolean) {
  selectedExtensions.value = selected
    ? [...selectedExtensions.value, extension]
    : selectedExtensions.value.filter((item) => item.name !== extension.name)
}

function toggleAllVisible(selected: boolean) {
  const visibleNames = new Set(
    visibleExtensions.value.map((extension) => extension.name)
  )
  selectedExtensions.value = selected
    ? [
        ...selectedExtensions.value.filter(
          (extension) => !visibleNames.has(extension.name)
        ),
        ...visibleExtensions.value
      ]
    : selectedExtensions.value.filter(
        (extension) => !visibleNames.has(extension.name)
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

const hasChanges = computed(() => {
  return changedExtensions.value.length > 0
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

const menu = ref<InstanceType<typeof Menu>>()
const contextMenuItems = computed(() => [
  {
    label: t('g.enableSelected'),
    icon: 'pi pi-check',
    command: async () => {
      selectedExtensions.value.forEach((ext) => {
        if (!extensionStore.isExtensionReadOnly(ext.name)) {
          editingEnabledExtensions.value[ext.name] = true
        }
      })
      await updateExtensionStatus()
    }
  },
  {
    label: t('g.disableSelected'),
    icon: 'pi pi-times',
    command: async () => {
      selectedExtensions.value.forEach((ext) => {
        if (!extensionStore.isExtensionReadOnly(ext.name)) {
          editingEnabledExtensions.value[ext.name] = false
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
