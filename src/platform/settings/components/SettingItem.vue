<template>
  <FormItem
    :id="setting.id"
    :item="formItem"
    :form-value="settingValue"
    @update:form-value="updateSettingValue"
  >
    <template #name-prefix>
      <Badge
        v-if="setting.id === 'Comfy.Locale'"
        severity="primary"
        class="pi pi-language"
      />
      <Tooltip v-if="setting.experimental">
        <TooltipTrigger as-child>
          <Badge severity="primary">
            <template #icon>
              <i-material-symbols:experiment-outline />
            </template>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t('g.experimental') }}</TooltipContent>
      </Tooltip>
    </template>
  </FormItem>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FormItem from '@/components/common/FormItem.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { st } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import type {
  SettingOption,
  SettingParams,
  Settings
} from '@/platform/settings/types'
import { normalizeI18nKey } from '@/utils/formatUtil'

const props = defineProps<{
  setting: SettingParams
}>()

const { t } = useI18n()

function translateOptions(
  options:
    | (SettingOption | string)[]
    | ((value: unknown) => (SettingOption | string)[])
) {
  if (typeof options === 'function') {
    return translateOptions(options(settingValue.value))
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
      ? st(`settings.${normalizedId}.tooltip`, props.setting.tooltip)
      : undefined,
    options: props.setting.options
      ? translateOptions(props.setting.options)
      : undefined
  }
})

const settingStore = useSettingStore()
const settingValue = computed(() => settingStore.get(props.setting.id))
async function updateSettingValue(newValue: unknown) {
  await settingStore.set(
    props.setting.id,
    newValue as Settings[typeof props.setting.id]
  )
}
</script>
