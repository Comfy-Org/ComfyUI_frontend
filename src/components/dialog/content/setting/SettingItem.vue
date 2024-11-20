<template>
  <GeneralSettingItem
    :setting="setting"
    :id="setting.id"
    :settingValue="settingValue"
    @update:settingValue="updateSettingValue"
  >
    <template #name-prefix>
      <Tag v-if="setting.experimental" :value="$t('experimental')" />
      <Tag
        v-if="setting.deprecated"
        :value="$t('deprecated')"
        severity="danger"
      />
    </template>
  </GeneralSettingItem>
</template>

<script setup lang="ts">
import GeneralSettingItem from '@/components/common/GeneralSettingItem.vue'
import { useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'
import { computed } from 'vue'

const props = defineProps<{
  setting: SettingParams
}>()

const settingStore = useSettingStore()
const settingValue = computed(() => settingStore.get(props.setting.id))
const updateSettingValue = (value: any) => {
  settingStore.set(props.setting.id, value)
}
</script>
