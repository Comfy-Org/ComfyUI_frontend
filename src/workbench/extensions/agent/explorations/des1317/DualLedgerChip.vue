<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Badge from '@comfyorg/design-system/badge/Badge'
import CreditBadge from '@comfyorg/design-system/badge/CreditBadge'
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { cn } from '@comfyorg/tailwind-utils'

const {
  freeAmount,
  paidAmount,
  activeLedger = 'free',
  freeLow = false,
  initiallyOpen = false
} = defineProps<{
  freeAmount: string
  paidAmount: string
  activeLedger?: 'free' | 'paid'
  freeLow?: boolean
  initiallyOpen?: boolean
}>()

const open = ref(initiallyOpen)
const { t } = useI18n()
</script>

<template>
  <PopoverRoot :open="open" @update:open="open = $event">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="textonly"
        size="unset"
        :aria-label="t('agent.explorations.des1317.ledgerDetails')"
        class="h-auto max-w-full gap-2 rounded-md px-1 py-0.5"
      >
        <span class="flex min-w-0 flex-col items-start gap-0.5">
          <span class="text-2xs text-muted-foreground">
            {{ t('agent.explorations.des1317.freeLedgerLabel') }}
          </span>
          <span
            :class="
              cn(
                'flex h-5 max-w-full items-center gap-1 rounded-md bg-input px-2 py-0.5 text-xs',
                activeLedger !== 'free' && 'text-muted-foreground'
              )
            "
          >
            <i
              aria-hidden="true"
              :class="
                cn(
                  'icon-[lucide--sparkles] aspect-square size-3.5',
                  freeLow && 'text-warning'
                )
              "
            />
            <span class="truncate">{{ freeAmount }}</span>
          </span>
        </span>
        <span class="flex min-w-0 flex-col items-start gap-0.5">
          <span class="text-2xs text-muted-foreground">
            {{ t('agent.explorations.des1317.paidLedgerLabel') }}
          </span>
          <span :class="cn(activeLedger !== 'paid' && 'opacity-60')">
            <CreditBadge :text="paidAmount" />
          </span>
        </span>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      side="bottom"
      :side-offset="8"
      class="agent-scope flex flex-col gap-3"
    >
      <p class="my-0 text-sm">
        {{
          activeLedger === 'paid'
            ? t('agent.explorations.des1317.paidActiveHint')
            : t('agent.explorations.des1317.freeActiveHint')
        }}
      </p>
      <div class="flex flex-col gap-1">
        <p class="my-0 text-sm font-medium">
          {{ t('agent.explorations.des1317.freeLedgerDetailTitle') }}
        </p>
        <p class="my-0 text-xs text-muted-foreground">
          {{ t('agent.explorations.des1317.freeLedgerDetailBody') }}
        </p>
      </div>
      <div class="flex flex-col gap-1">
        <p class="my-0 text-sm font-medium">
          {{ t('agent.explorations.des1317.paidLedgerDetailTitle') }}
        </p>
        <p class="my-0 text-xs text-muted-foreground">
          {{ t('agent.explorations.des1317.paidLedgerDetailBody') }}
        </p>
      </div>
      <Badge
        variant="compact"
        severity="muted"
        class="w-fit font-normal normal-case"
      >
        {{ t('agent.explorations.des1317.updatedLag') }}
      </Badge>
    </PopoverContent>
  </PopoverRoot>
</template>
