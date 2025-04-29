<template>
  <FormItem
    :id="setting.id"
    :item="formItem"
    :form-value="settingValue"
    @update:form-value="updateSettingValue"
  >
    <template #name-prefix>
      <Tag v-if="setting.id === 'Comfy.Locale'" class="pi pi-language" />
      <Tag
        v-if="setting.experimental"
        v-tooltip="{
          value: $t('g.experimental'),
          showDelay: 600
        }"
      >
        <template #icon>
          <i-material-symbols:experiment-outline />
        </template>
      </Tag>
    </template>
  </FormItem>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FormItem from '@/components/common/FormItem.vue'
import { useSettingStore } from '@/stores/settingStore'
import type { SettingOption, SettingParams } from '@/types/settingTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'

const props = defineProps<{
  setting: SettingParams
}>()

const { t } = useI18n()
function translateOptions(options: (SettingOption | string)[]) {
  if (typeof options === 'function') {
    // @ts-expect-error: Audit and deprecate usage of legacy options type:
    // (value) => [string | {text: string, value: string}]
    return translateOptions(options(props.setting.value ?? ''))
  }

  return options.map((option) => {
    const optionLabel = typeof option === 'string' ? option : option.text
    const optionValue = typeof option === 'string' ? option : option.value

    return {
      text: t(
        `settings.${normalizeI18nKey(props.setting.id)}.options.${normalizeI18nKey(optionLabel)}`,
        optionLabel
      ),
      value: optionValue
    }
  })
}

const formItem = computed(() => {
  const normalizedId = normalizeI18nKey(props.setting.id)
  return {
    ...props.setting,
    name: t(`settings.${normalizedId}.name`, props.setting.name),
    tooltip: props.setting.tooltip
      ? t(`settings.${normalizedId}.tooltip`, props.setting.tooltip)
      : undefined,
    options: props.setting.options
      ? translateOptions(props.setting.options)
      : undefined
  }
})

const settingStore = useSettingStore()
const settingValue = computed(() => settingStore.get(props.setting.id))
const updateSettingValue = async (value: any) => {
  await settingStore.set(props.setting.id, value)
}
</script>
