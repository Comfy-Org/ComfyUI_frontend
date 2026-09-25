<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { label, open, partner } = defineProps<{
  label: string
  open: boolean
  partner: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center pr-4.5">
    <span class="flex-1 text-sm/snug text-text-secondary">{{ label }}</span>
    <span
      v-for="column in [
        { label: t('partnerNodesEducation.openHeader'), included: open },
        { label: t('partnerNodesEducation.partnerHeader'), included: partner }
      ]"
      :key="column.label"
      class="flex w-15 justify-center"
    >
      <i
        :class="
          column.included
            ? 'icon-[lucide--check] text-brand-yellow'
            : 'icon-[lucide--minus] text-muted-foreground'
        "
        class="size-4"
        aria-hidden="true"
      />
      <span class="sr-only">
        {{ column.label }}:
        {{
          column.included
            ? t('partnerNodesEducation.included')
            : t('partnerNodesEducation.notIncluded')
        }}
      </span>
    </span>
  </div>
</template>
