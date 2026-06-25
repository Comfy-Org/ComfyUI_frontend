<template>
  <div class="extension-panel flex flex-col gap-2">
    <SearchInput
      v-model="filters['global'].value"
      :placeholder="$t('g.searchPlaceholder', { subject: $t('g.extensions') })"
    />
    <Message
      v-if="hasChanges"
      severity="info"
      pt:text="w-full"
      class="max-h-96 overflow-y-auto"
    >
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
      <SelectButton
        v-model="filterType"
        :options="filterTypes"
        option-label="label"
        option-value="value"
      />
    </div>
    <DataTable
      v-model:selection="selectedExtensions"
      :value="filteredExtensions"
      striped-rows
      size="small"
      :filters="filters"
      selection-mode="multiple"
      data-key="name"
    >
      <Column selection-mode="multiple" :frozen="true" style="width: 3rem" />
      <Column :header="$t('g.extensionName')" sortable field="name">
        <template #body="slotProps">
          {{ slotProps.data.name }}
          <Tag
            v-if="extensionStore.isCoreExtension(slotProps.data.name)"
            :value="$t('g.core')"
          />
          <Tag v-else :value="$t('g.custom')" severity="info" />
        </template>
      </Column>
      <Column
        :pt="{
          headerCell: 'flex items-center justify-end',
          bodyCell: 'flex items-center justify-end'
        }"
      >
        <template #header>
          <DropdownMenu :modal="false">
            <DropdownMenuTrigger as-child>
              <Button size="icon" variant="muted-textonly">
                <i class="icon-[lucide--ellipsis]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent size="lg" align="end" :side-offset="4">
              <template v-for="(menuItem, idx) in contextMenuItems" :key="idx">
                <DropdownMenuSeparator v-if="menuItem.separator" />
                <DropdownMenuItem
                  v-else
                  :disabled="menuItem.disabled"
                  @select="() => menuItem.command?.()"
                >
                  <template v-if="menuItem.icon" #icon>
                    <i :class="menuItem.icon" />
                  </template>
                  {{ menuItem.label }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </template>
        <template #body="slotProps">
          <ToggleSwitch
            v-model="editingEnabledExtensions[slotProps.data.name]"
            :disabled="extensionStore.isExtensionReadOnly(slotProps.data.name)"
            @change="updateExtensionStatus"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { FilterMatchMode } from '@primevue/core/api'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
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

const filters = ref({
  global: { value: '', matchMode: FilterMatchMode.CONTAINS }
})

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

type MenuEntry = {
  separator?: boolean
  label?: string
  icon?: string
  disabled?: boolean
  command?: () => void | Promise<void>
}

const contextMenuItems = computed<MenuEntry[]>(() => [
  {
    label: t('g.enableSelected'),
    icon: 'icon-[lucide--check]',
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
    icon: 'icon-[lucide--x]',
    command: async () => {
      selectedExtensions.value.forEach((ext) => {
        if (!extensionStore.isExtensionReadOnly(ext.name)) {
          editingEnabledExtensions.value[ext.name] = false
        }
      })
      await updateExtensionStatus()
    }
  },
  { separator: true },
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
  }
])
</script>
