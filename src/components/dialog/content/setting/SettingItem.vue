<template>
  <FormItem
    :item="formItem"
    :id="setting.id"
    :formValue="settingValue"
    @update:formValue="updateSettingValue"
  >
    <template #name-prefix>
      <Tag v-if="setting.experimental" :value="$t('g.experimental')" />
      <Tag
        v-if="setting.deprecated"
        :value="$t('g.deprecated')"
        severity="danger"
      />
    </template>
  </FormItem>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import FormItem from '@/components/common/FormItem.vue'
import { useSettingStore } from '@/stores/settingStore'
import { SettingOption, SettingParams } from '@/types/settingTypes'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  setting: SettingParams
}>()

const { t, te } = useI18n()
function st(key: string, fallbackMessage: string) {
  return te(key) ? t(key) : fallbackMessage
}

const formItem = computed(() => {
  const { id, options } = props.setting
  const normalizedId = id.replace(/\./g, '_')

  const baseKey = `settingsDialog.${normalizedId}`
  const nameKey = `${baseKey}.name`
  const tooltipKey = `${baseKey}.tooltip`

  const translatedOptions = Array.isArray(options)
    ? options.map((opt) => {
        const option: SettingOption =
          typeof opt === 'string' ? { value: opt, text: opt } : { ...opt }
        const key = `${baseKey}.options.${option.value}`

        if (te(key)) option.text = t(key)
        return option
      })
    : options

  return {
    ...props.setting,
    name: te(nameKey) ? t(nameKey) : props.setting.name,
    tooltip: props.setting.tooltip
      ? te(tooltipKey)
        ? t(tooltipKey)
        : props.setting.tooltip
      : undefined,
    options: translatedOptions
  }
})

const settingStore = useSettingStore()
const settingValue = computed(() => settingStore.get(props.setting.id))
const updateSettingValue = (value: any) => {
  settingStore.set(props.setting.id, value)
}
</script>
