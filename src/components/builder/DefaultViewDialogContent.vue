<template>
  <BuilderDialog @close="$emit('close')">
    <template #title>
      {{ $t('builderToolbar.defaultViewTitle') }}
    </template>

    <div class="flex flex-col gap-2">
      <label class="text-sm text-muted-foreground">
        {{ $t('builderToolbar.defaultViewLabel') }}
      </label>
      <div role="radiogroup" class="flex flex-col gap-2">
        <Button
          v-for="option in viewTypeOptions"
          :key="option.value.toString()"
          role="radio"
          :aria-checked="openAsApp === option.value"
          :class="
            cn(
              itemClasses,
              openAsApp === option.value && 'bg-secondary-background'
            )
          "
          variant="textonly"
          @click="openAsApp = option.value"
        >
          <div
            class="flex size-8 min-h-8 items-center justify-center rounded-lg bg-secondary-background-hover"
          >
            <i :class="cn(option.icon, 'size-4')" />
          </div>
          <div class="mx-2 flex flex-1 flex-col items-start">
            <span class="text-sm font-medium text-base-foreground">
              {{ option.title }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ option.subtitle }}
            </span>
          </div>
          <i
            v-if="openAsApp === option.value"
            class="icon-[lucide--check] size-4 text-base-foreground"
          />
        </Button>
      </div>
    </div>

    <template #footer>
      <Button variant="muted-textonly" size="lg" @click="$emit('close')">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="secondary" size="lg" @click="$emit('apply', openAsApp)">
        {{ $t('g.apply') }}
      </Button>
    </template>
  </BuilderDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

import BuilderDialog from './BuilderDialog.vue'

const { t } = useI18n()

const { initialOpenAsApp = true } = defineProps<{
  initialOpenAsApp?: boolean
}>()

defineEmits<{
  apply: [openAsApp: boolean]
  close: []
}>()

const openAsApp = ref(initialOpenAsApp)

const viewTypeOptions = [
  {
    value: true,
    icon: 'icon-[lucide--app-window]',
    title: t('builderToolbar.app'),
    subtitle: t('builderToolbar.appDescription')
  },
  {
    value: false,
    icon: 'icon-[comfy--workflow]',
    title: t('builderToolbar.nodeGraph'),
    subtitle: t('builderToolbar.nodeGraphDescription')
  }
]

const itemClasses =
  'flex h-14 cursor-pointer items-center gap-2 self-stretch rounded-lg border-none bg-transparent py-2 pr-4 pl-2 text-base-foreground transition-colors hover:bg-secondary-background'
</script>
