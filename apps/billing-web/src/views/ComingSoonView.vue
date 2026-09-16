<script setup lang="ts">
import HostedSurface from '@/components/HostedSurface.vue'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { useBillingEntry } from '@/entry/billingEntry'

const { coded } = useHostedCopy()
const { entry } = useBillingEntry()
</script>

<template>
  <HostedSurface>
    <p class="m-0 text-sm text-muted-foreground">
      {{ coded('comingSoon', entry?.intent) }}
    </p>
  </HostedSurface>
</template>
