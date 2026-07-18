<template>
  <section
    data-testid="error-resolution-panel"
    :class="
      cn(
        'pointer-events-auto fixed z-1000 flex flex-col overflow-hidden border-interface-stroke bg-base-background',
        isNarrow
          ? 'inset-x-0 top-0 border-b'
          : cn(
              // Centered in the band above the canvas menu (or the open
              // minimap): equal 10%-of-band gaps top and bottom
              'right-1 w-90 max-w-[calc(100vw-0.5rem)] rounded-lg border shadow-interface',
              isMinimapVisible
                ? 'top-[calc((100%-258px)/10)] bottom-[calc(258px+(100%-258px)/10)]'
                : 'top-[calc((100%-58px)/10)] bottom-[calc(58px+(100%-58px)/10)]'
            )
      )
    "
    :aria-label="t('errorResolution.title')"
  >
    <!-- Persistent live region: one inserted with its content is not announced -->
    <span role="status" class="sr-only">
      {{ isResolved ? t('errorResolution.allResolved') : '' }}
    </span>
    <div
      v-if="isNarrow"
      class="flex min-w-0 shrink-0 items-center gap-2 bg-base-foreground/5 p-2"
    >
      <Button
        data-testid="error-resolution-back"
        variant="base"
        size="icon"
        class="shrink-0 border border-interface-stroke"
        :aria-label="t('errorResolution.backToApp')"
        @click="emit('back')"
      >
        <i class="icon-[lucide--arrow-left] size-4" />
      </Button>
      <template v-if="isResolved">
        <i
          aria-hidden="true"
          class="icon-[lucide--circle-check] size-5 shrink-0 text-success-background"
        />
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">
          {{ t('errorResolution.allResolved') }}
        </span>
      </template>
      <template v-else>
        <span
          class="flex h-10 min-w-7 shrink-0 items-center justify-center px-1 text-2xl/none font-extrabold text-destructive-background-hover tabular-nums"
        >
          {{ totalErrorCount }}
        </span>
        <span
          aria-hidden="true"
          class="h-8 w-px shrink-0 bg-interface-stroke"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5 px-1">
          <span
            class="truncate text-xs/tight font-semibold text-base-foreground"
          >
            {{ t('rightSidePanel.errorsDetected', totalErrorCount) }}
          </span>
          <span class="truncate text-2xs/tight text-muted-foreground">
            {{ t('rightSidePanel.resolveBeforeRun') }}
          </span>
        </div>
      </template>

      <Button
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
      <div v-if="!isNarrow || isExpanded" class="flex min-h-0 flex-1 flex-col">
        <div
          v-if="isResolved"
          class="flex min-h-0 flex-1 flex-col bg-interface-panel-surface p-3"
        >
          <div
            class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-secondary-background px-6 py-8 text-center"
          >
            <i
              aria-hidden="true"
              class="icon-[lucide--circle-check] size-10 text-success-background"
            />
            <p class="m-0 text-sm font-semibold text-base-foreground">
              {{ t('errorResolution.allResolved') }}
            </p>
            <p class="m-0 text-sm text-muted-foreground">
              {{ t('errorResolution.allResolvedDesc') }}
            </p>
            <Button variant="secondary" class="mt-2" @click="emit('back')">
              <i class="icon-[lucide--arrow-left] size-4" />
              {{ t('errorResolution.backToApp') }}
            </Button>
          </div>
        </div>
        <ErrorGroupList
          v-else
          :show-search="false"
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
