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
import { SettingParams } from '@/types/settingTypes'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  setting: SettingParams
}>()

const { t, te } = useI18n()
const formItem = computed(() => {
  const { id, options } = props.setting
  const normalizedId = id.replace(/\./g, '_')

  const baseKey = `settingsDialog.${normalizedId}`
  const nameKey = `${baseKey}.name`
  const tooltipKey = `${baseKey}.tooltip`

  let translatedOptions: typeof options | undefined

  if (Array.isArray(options)) {
    translatedOptions = options.map((opt) => {
      const value = typeof opt === 'string' ? opt : opt.value
      const optionKey = `${baseKey}.options.${value}`
      const translatedText = te(optionKey)
        ? t(optionKey)
        : typeof opt === 'string'
          ? opt
          : opt.text

      return typeof opt === 'string'
        ? translatedText
        : { ...opt, text: translatedText }
    })
  }

  return {
    ...props.setting,
    name: te(nameKey) ? t(nameKey) : props.setting.name,
    tooltip: props.setting.tooltip
      ? te(tooltipKey)
        ? t(tooltipKey)
        : props.setting.tooltip
      : undefined,
    options: translatedOptions ?? options
  }
})

const settingStore = useSettingStore()
const settingValue = computed(() => settingStore.get(props.setting.id))
const updateSettingValue = (value: any) => {
  settingStore.set(props.setting.id, value)
}
</script>
