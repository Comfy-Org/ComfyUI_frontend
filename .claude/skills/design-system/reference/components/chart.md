# ChartBar / ChartLine

**Path:** `src/components/ui/chart/{ChartBar,ChartLine}.vue`, `useChart.ts`
**Built on:** Chart.js (not Reka UI)

## Purpose

Thin Vue wrappers around Chart.js bar/line charts with a shared dark-UI-themed default styling (legend/tooltip/axis colors read from CSS variables `--color-base-foreground`/`--color-muted-foreground`).

## Props (identical shape for both)

| Prop        | Type                                                | Notes                                          |
| ----------- | --------------------------------------------------- | ---------------------------------------------- |
| `data`      | `ChartData<'bar'>` / `ChartData<'line'>` (required) |                                                |
| `options`   | `ChartOptions<'bar'>` / `ChartOptions<'line'>`      |                                                |
| `ariaLabel` | `string`                                            | sets `role="img"` + `aria-label` on the canvas |
| `class`     | `string`                                            |                                                |

## Usage

```vue
<script setup lang="ts">
import ChartBar from '@/components/ui/chart/ChartBar.vue'

const data = {
  labels: ['A', 'B', 'C', 'D'],
  datasets: [
    { label: 'Series 1', data: [10, 50, 35, 75], backgroundColor: '#ff8000' }
  ]
}
</script>

<template>
  <ChartBar aria-label="Bar chart example" :data="data" />
</template>
```

## Do

- Always set `ariaLabel` — Chart.js canvases are otherwise opaque to screen readers.
- Expect charts to render on a `bg-component-node-widget-background` surface by default (`p-6 rounded-lg` wrapper is built in).

## Don't

- Don't pass a full custom `options` object expecting it to fully replace the defaults — `useChart` deep-merges your `options` over its theme defaults.
