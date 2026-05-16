<template>
  <div
    class="fixed top-1/2 left-1/2 z-99999 flex -translate-1/2 flex-col gap-2 rounded-lg border border-border-default bg-comfy-menu-bg p-3 text-xs shadow-lg"
  >
    <div class="flex items-center gap-2">
      <span class="w-32 text-muted-foreground">{{
        $t('essentials.devPicker.subgroupGap')
      }}</span>
      <button
        v-for="option in GAP_OPTIONS"
        :key="option"
        type="button"
        :class="optionClass(subgroupGap === option)"
        @click="subgroupGap = option"
      >
        {{ option }}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-32 text-muted-foreground">{{
        $t('essentials.devPicker.sectionColor')
      }}</span>
      <button
        v-for="option in HEADER_COLOR_OPTIONS"
        :key="option.id"
        type="button"
        :class="optionClass(sectionHeaderColor === option.id)"
        @click="sectionHeaderColor = option.id"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-32 text-muted-foreground">{{
        $t('essentials.devPicker.subsectionColor')
      }}</span>
      <button
        v-for="option in HEADER_COLOR_OPTIONS"
        :key="option.id"
        type="button"
        :class="optionClass(subsectionHeaderColor === option.id)"
        @click="subsectionHeaderColor = option.id"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-32 text-muted-foreground">{{
        $t('essentials.devPicker.sectionSize')
      }}</span>
      <button
        v-for="option in HEADER_SIZE_OPTIONS"
        :key="option.id"
        type="button"
        :class="optionClass(sectionHeaderSize === option.id)"
        @click="sectionHeaderSize = option.id"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-32 text-muted-foreground">{{
        $t('essentials.devPicker.subsectionSize')
      }}</span>
      <button
        v-for="option in HEADER_SIZE_OPTIONS"
        :key="option.id"
        type="button"
        :class="optionClass(subsectionHeaderSize === option.id)"
        @click="subsectionHeaderSize = option.id"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-32 text-muted-foreground">{{
        $t('essentials.devPicker.tileColumns')
      }}</span>
      <button
        v-for="option in TILE_COLUMN_OPTIONS"
        :key="option.id"
        type="button"
        :class="optionClass(tileColumns === option.id)"
        @click="tileColumns = option.id"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-32 text-muted-foreground">{{
        $t('essentials.devPicker.jumpToMenu')
      }}</span>
      <button
        v-for="option in JUMP_TO_VARIANTS"
        :key="option.id"
        type="button"
        :class="optionClass(jumpToVariant === option.id)"
        @click="jumpToVariant = option.id"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-32 text-muted-foreground">{{
        $t('essentials.devPicker.collapsible')
      }}</span>
      <button
        type="button"
        :class="optionClass(collapsibleSections)"
        @click="collapsibleSections = true"
      >
        {{ $t('essentials.devPicker.on') }}
      </button>
      <button
        type="button"
        :class="optionClass(!collapsibleSections)"
        @click="collapsibleSections = false"
      >
        {{ $t('essentials.devPicker.off') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEssentialsSubgroupGap } from '@/composables/useEssentialsSubgroupGap'
import { cn } from '@comfyorg/tailwind-utils'

const {
  subgroupGap,
  sectionHeaderColor,
  subsectionHeaderColor,
  sectionHeaderSize,
  subsectionHeaderSize,
  tileColumns,
  jumpToVariant,
  collapsibleSections,
  GAP_OPTIONS,
  HEADER_COLOR_OPTIONS,
  HEADER_SIZE_OPTIONS,
  TILE_COLUMN_OPTIONS,
  JUMP_TO_VARIANTS
} = useEssentialsSubgroupGap()

const optionClass = (active: boolean) =>
  cn(
    'cursor-pointer rounded-sm px-2 py-1 transition-colors',
    active ? 'text-primary-foreground bg-primary' : 'hover:bg-comfy-input'
  )
</script>
