# CreditSlider

**Path:** `src/components/ui/credit-slider/CreditSlider.vue`
**Built on:** `ui/slider/Slider.vue` (domain-specific composite, not a generic primitive)

## Purpose

Pricing/plan slider that snaps to a fixed, discrete set of stops and renders the resulting price, a "save X%" badge, and per-stop labels. Tightly coupled to the cloud subscription/billing domain — **do not reuse this for a generic slider need**; use `Slider` and build a domain-specific wrapper the same way this one does.

Note there are **two** `CreditSlider` components in the codebase with near-identical behavior: this generic one (`ui/credit-slider/CreditSlider.vue`, documented here) and a separate `src/platform/cloud/subscription/components/CreditSlider.vue`. Check which one a given call site actually imports before assuming behavior transfers.

## Props

| Prop               | Type                      | Default                        |
| ------------------ | ------------------------- | ------------------------------ |
| `disabled`         | `boolean`                 | `false`                        |
| `class`            | `HTMLAttributes['class']` | —                              |
| `stops`            | `readonly CreditStop[]`   | `TEAM_PLAN_CREDIT_STOPS`       |
| `defaultStopIndex` | `number`                  | `DEFAULT_TEAM_PLAN_STOP_INDEX` |
| `cycle`            | `'monthly' \| 'yearly'`   | `'yearly'`                     |

`CreditStop = { id?: string; usd: number; credits: number; discountPercentYearly: number }`

`defineModel<number>` (bound to the selected stop's `usd`). Emits `change: [stop: { index: number; usd: number; credits: number }]`.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import CreditSlider from '@/components/ui/credit-slider/CreditSlider.vue'

const value = ref(700)
</script>

<template>
  <CreditSlider v-model="value" @change="onChange" />
</template>
```

## Notes

This is a reference example of **how to build a domain-specific composite** on top of a generic primitive (`Slider` driven in index-space so the thumb only lands on discrete stops), not a general-purpose building block. If your prototype needs a "snap to labeled stops" slider outside billing, follow this file's pattern rather than importing `CreditSlider` itself.

Verified against the live Storybook story: the per-stop labels below the track show each stop's **credit count**, compact-formatted (e.g. `147.7K`) with a small credits icon — not a dollar amount. The "save X%" pill is an **outlined** badge (`border-2 border-primary-background`, accent-colored text, transparent fill), not a filled/solid badge.
