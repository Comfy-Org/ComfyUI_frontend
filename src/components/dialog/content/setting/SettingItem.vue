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
import type { SettingOption, SettingParams } from '@/types/settingTypes'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeI18nKey } from '@/utils/formatUtil'

const props = defineProps<{
  setting: SettingParams
}>()

const { t } = useI18n()
function translateOptions(options: (SettingOption | string)[]) {
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
const updateSettingValue = (value: any) => {
  settingStore.set(props.setting.id, value)
}
</script>
