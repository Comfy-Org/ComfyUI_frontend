<template>
  <FormItem
    :item="formItem"
    :id="setting.id"
    :formValue="settingValue"
    @update:formValue="updateSettingValue"
  >
    <template #name-prefix>
      <Tag v-if="setting.experimental" :value="$t('experimental')" />
      <Tag
        v-if="setting.deprecated"
        :value="$t('deprecated')"
        severity="danger"
      />
    </template>
  </FormItem>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import FormItem from '@/components/common/FormItem.vue'
import { useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  setting: SettingParams
}>()

const { t } = useI18n()
const formItem = computed(() => {
  const normalizedId = props.setting.id.replace(/\./g, '_')
  return {
    ...props.setting,
    name: t(`settingsDialog.${normalizedId}.name`, props.setting.name),
    tooltip: props.setting.tooltip
      ? t(`settingsDialog.${normalizedId}.tooltip`, props.setting.tooltip)
      : undefined
  }
})

const settingStore = useSettingStore()
const settingValue = computed(() => settingStore.get(props.setting.id))
const updateSettingValue = (value: any) => {
  settingStore.set(props.setting.id, value)
}
</script>
