<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'
import {
  selectContentClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from '@comfyorg/design-system/select.variants'
import { cn } from '@comfyorg/tailwind-utils'

const { methods } = defineProps<{
  methods: readonly SavedPaymentMethod[]
}>()

const selectedId = defineModel<string>({ required: true })

const { t } = useI18n()

const chosen = computed(() =>
  methods.find((method) => method.id === selectedId.value)
)

/** Cards carry brand and last4; Alipay is a linked account with neither. */
function partsOf(method: SavedPaymentMethod) {
  return method.type === 'alipay'
    ? {
        icon: 'icon-[lucide--wallet]',
        name: t('checkout.fullPage.saved.alipay'),
        detail: undefined
      }
    : {
        icon: 'icon-[lucide--credit-card]',
        name: method.brand,
        detail:
          method.last4 === undefined
            ? undefined
            : t('checkout.fullPage.saved.last4', { last4: method.last4 })
      }
}
</script>

<template>
  <p
    v-if="methods.length === 1 && chosen"
    class="m-0 flex h-10 w-full items-center gap-3 rounded-lg bg-base-background px-4 text-sm"
  >
    <i
      :class="cn(partsOf(chosen).icon, 'size-4 shrink-0 text-muted-foreground')"
      aria-hidden="true"
    />
    <span class="text-base-foreground capitalize">
      {{ partsOf(chosen).name }}
    </span>
    <span
      v-if="partsOf(chosen).detail"
      class="text-muted-foreground tabular-nums"
    >
      {{ partsOf(chosen).detail }}
    </span>
  </p>
  <SelectRoot v-else v-model="selectedId">
    <SelectTrigger
      :aria-label="t('checkout.fullPage.saved.selectLabel')"
      :class="
        cn(
          selectTriggerVariants({ size: 'lg', border: 'none' }),
          'w-full gap-3 bg-base-background px-4 text-sm'
        )
      "
    >
      <template v-if="chosen">
        <i
          :class="
            cn(partsOf(chosen).icon, 'size-4 shrink-0 text-muted-foreground')
          "
          aria-hidden="true"
        />
        <span class="text-base-foreground capitalize">
          {{ partsOf(chosen).name }}
        </span>
        <span
          v-if="partsOf(chosen).detail"
          class="text-muted-foreground tabular-nums"
        >
          {{ partsOf(chosen).detail }}
        </span>
      </template>
      <i
        class="ml-auto icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="8"
        align="start"
        :class="cn(selectContentClass, 'min-w-(--reka-select-trigger-width)')"
        @keydown="stopEscapeToDocument"
      >
        <SelectViewport class="w-full">
          <SelectItem
            v-for="method in methods"
            :key="method.id"
            :value="method.id"
            :class="selectItemVariants({ layout: 'single' })"
          >
            <SelectItemText class="flex items-center gap-3">
              <i
                :class="cn(partsOf(method).icon, 'size-4 shrink-0')"
                aria-hidden="true"
              />
              <span class="capitalize">{{ partsOf(method).name }}</span>
              <span
                v-if="partsOf(method).detail"
                class="text-muted-foreground tabular-nums"
              >
                {{ partsOf(method).detail }}
              </span>
            </SelectItemText>
            <SelectItemIndicator class="flex shrink-0 items-center">
              <i class="icon-[lucide--check] size-4" aria-hidden="true" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
