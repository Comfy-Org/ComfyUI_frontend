<template>
  <section
    data-testid="error-resolution-panel"
    :class="
      cn(
        'pointer-events-auto fixed z-1000 flex flex-col overflow-hidden border-interface-stroke bg-base-background',
        isNarrow
          ? 'inset-x-0 top-0 border-b'
          : cn(
              'top-14 right-1 w-90 max-w-[calc(100vw-0.5rem)] rounded-lg border shadow-interface',
              isMinimapVisible ? 'bottom-66' : 'bottom-[54px]'
            )
      )
    "
    :aria-label="t('errorResolution.title')"
  >
    <div class="flex min-w-0 shrink-0 items-center gap-2 p-2">
      <Button
        v-if="isNarrow"
        data-testid="error-resolution-back"
        variant="secondary"
        class="shrink-0"
        @click="emit('back')"
      >
        <i class="icon-[lucide--arrow-left] size-4" />
        {{ t('errorResolution.backToApp') }}
      </Button>

      <template v-if="isResolved">
        <i
          aria-hidden="true"
          class="icon-[lucide--circle-check] size-4 shrink-0 text-success-background"
        />
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">
          {{ t('errorResolution.allResolved') }}
        </span>
      </template>
      <template v-else>
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive-background/15 text-xs font-extrabold text-destructive-background-hover tabular-nums"
        >
          {{ totalErrorCount }}
        </span>
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">
          {{
            isNarrow
              ? t('rightSidePanel.errorsDetected', totalErrorCount)
              : t('errorResolution.title')
          }}
        </span>
      </template>

      <Button
        v-if="isNarrow"
        variant="textonly"
        size="icon"
        class="shrink-0"
        :aria-label="
          isExpanded
            ? t('errorResolution.hideErrors')
            : t('errorResolution.showErrors')
        "
        :aria-expanded="isExpanded"
        @click="isExpanded = !isExpanded"
      >
        <i
          :class="
            cn(
              'size-4',
              isExpanded
                ? 'icon-[lucide--chevron-up]'
                : 'icon-[lucide--chevron-down]'
            )
          "
        />
      </Button>
    </div>

    <TransitionCollapse>
      <div v-if="!isNarrow || isExpanded" class="flex min-h-0 flex-col">
        <div
          v-if="isResolved"
          class="flex flex-col items-center gap-3 px-6 pt-4 pb-6 text-center"
        >
          <i
            aria-hidden="true"
            class="icon-[lucide--circle-check] size-10 text-success-background"
          />
          <p class="m-0 text-sm text-muted-foreground">
            {{ t('errorResolution.allResolvedDesc') }}
          </p>
          <Button variant="primary" size="lg" @click="emit('back')">
            <i class="icon-[lucide--arrow-left] size-4" />
            {{ t('errorResolution.backToApp') }}
          </Button>
        </div>
        <ErrorGroupList
          v-else
          :show-search="!isNarrow"
          :carousel="isNarrow"
          class="min-h-0 flex-1"
        />
      </div>
    </TransitionCollapse>
  </section>
</template>

<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import ErrorGroupList from '@/components/rightSidePanel/errors/ErrorGroupList.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import Button from '@/components/ui/button/Button.vue'
import { useErrorGroups } from '@/components/rightSidePanel/errors/useErrorGroups'
import { useSettingStore } from '@/platform/settings/settingStore'

const emit = defineEmits<{
  back: []
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const isNarrow = useBreakpoints(breakpointsTailwind).smaller('md')
const isExpanded = ref(true)

const isMinimapVisible = computed(() =>
  settingStore.get('Comfy.Minimap.Visible')
)

const { allErrorGroups } = useErrorGroups('')
const totalErrorCount = computed(() =>
  allErrorGroups.value.reduce((sum, group) => sum + group.count, 0)
)
const isResolved = computed(() => allErrorGroups.value.length === 0)
</script>
