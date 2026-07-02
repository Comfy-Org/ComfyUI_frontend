import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import GeneratingCard from './GeneratingCard.vue'
import GeneratingScreen from './GeneratingScreen.vue'
import { GENERATING_CARD_LIMIT } from './linearOutputStore'
import type { InProgressItem } from './linearModeTypes'

const meta: Meta<typeof GeneratingScreen> = {
  title: 'LinearMode/GeneratingScreen',
  component: GeneratingScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div class="h-screen w-screen bg-[var(--color-workspace-bg)]">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

function swatch(seed: number): string {
  const hue = (seed * 67) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue} 60% 55%)"/><stop offset="100%" stop-color="hsl(${(hue + 40) % 360} 55% 30%)"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Newest first, matching the store's generatingCards order.
const fanCards: InProgressItem[] = [
  {
    id: 'c5',
    jobId: 'job',
    seq: 5,
    state: 'latent',
    latentPreviewUrl: swatch(5)
  },
  {
    id: 'c4',
    jobId: 'job',
    seq: 4,
    state: 'latent',
    latentPreviewUrl: swatch(4)
  },
  {
    id: 'c3',
    jobId: 'job',
    seq: 3,
    state: 'latent',
    latentPreviewUrl: swatch(3)
  },
  {
    id: 'c2',
    jobId: 'job',
    seq: 2,
    state: 'latent',
    latentPreviewUrl: swatch(2)
  },
  {
    id: 'c1',
    jobId: 'job',
    seq: 1,
    state: 'latent',
    latentPreviewUrl: swatch(1)
  }
]

function fanned(cards: InProgressItem[]) {
  const total = cards.length
  return cards.map((card, depth) => ({ card, depth, total })).reverse()
}

// The real screen, wired to the store (empty fan): shows the ambient glow,
// status text, progress bar and Stop button.
export const Empty: Story = {}

// Composite preview of the popping-card fan over the ambient glow, using the
// same markup the screen builds around GeneratingCard.
export const Fan: Story = {
  render: () => ({
    components: { GeneratingCard },
    setup: () => ({ cards: fanned(fanCards) }),
    template: `
      <div class="flex h-full w-full items-center justify-center @container-size">
        <div class="relative flex h-[min(50cqh,320px)] w-[440px] items-center justify-center overflow-visible">
          <div class="pointer-events-none absolute top-1/2 left-1/2 size-[min(150cqw,150cqh,760px)] -translate-1/2">
            <span class="gen-glow" />
          </div>
          <div class="pointer-events-none absolute inset-0">
            <GeneratingCard
              v-for="{ card, depth, total } in cards"
              :key="card.id"
              :card="card"
              :depth="depth"
              :total="total"
            />
          </div>
        </div>
      </div>
    `
  })
}

// Interactive harness for the fan: add cards to watch the pop-in entrance and
// reflow, remove the newest to watch it leave, and reset to clear. Adding past
// GENERATING_CARD_LIMIT evicts the oldest so the eviction fade is visible too.
export const Interactive: Story = {
  render: () => ({
    components: { GeneratingCard },
    setup() {
      const cards = ref<InProgressItem[]>([])
      let seq = 0

      function add() {
        seq += 1
        const next: InProgressItem = {
          id: `c${seq}`,
          jobId: 'job',
          seq,
          state: 'latent',
          latentPreviewUrl: swatch(seq)
        }
        cards.value = [next, ...cards.value].slice(0, GENERATING_CARD_LIMIT)
      }
      function remove() {
        cards.value = cards.value.slice(1)
      }
      function reset() {
        cards.value = []
      }

      const fanCards = computed(() => {
        const total = cards.value.length
        return cards.value
          .map((card, depth) => ({ card, depth, total }))
          .reverse()
      })

      const btnClass =
        'rounded-lg bg-secondary-background px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-border-subtle transition-opacity hover:opacity-70'

      return { fanCards, add, remove, reset, btnClass }
    },
    template: `
      <div class="@container-size flex h-full w-full flex-col items-center justify-center gap-10">
        <div class="flex gap-2">
          <button :class="btnClass" @click="add">Add card</button>
          <button :class="btnClass" @click="remove">Remove newest</button>
          <button :class="btnClass" @click="reset">Reset</button>
        </div>
        <div class="relative flex h-[min(50cqh,320px)] w-[440px] items-center justify-center overflow-visible">
          <div class="pointer-events-none absolute top-1/2 left-1/2 size-[min(150cqw,150cqh,760px)] -translate-1/2">
            <span class="gen-glow" />
          </div>
          <TransitionGroup tag="div" name="genfan" class="pointer-events-none absolute inset-0">
            <GeneratingCard
              v-for="{ card, depth, total } in fanCards"
              :key="card.id"
              :card="card"
              :depth="depth"
              :total="total"
            />
          </TransitionGroup>
        </div>
      </div>
    `
  })
}
