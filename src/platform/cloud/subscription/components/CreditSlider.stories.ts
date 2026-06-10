import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import CreditSlider from './CreditSlider.vue'

const meta: Meta<typeof CreditSlider> = {
  title: 'Platform/Subscription/CreditSlider',
  component: CreditSlider,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    disabled: { control: 'boolean' }
  },
  args: {
    disabled: false
  },
  decorators: [
    (story) => ({
      components: { story },
      // Previews at the real layout width: the Figma "Team Plan" card column is
      // 512px wide with 32px padding (DES-197), i.e. a 448px content area — the
      // width the slider actually renders into inside PricingTableWorkspace.
      template: '<div class="w-[512px] px-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { CreditSlider },
    setup() {
      const value = ref(700)
      return { args, value }
    },
    template: '<CreditSlider v-model="value" :disabled="args.disabled" />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { CreditSlider },
    setup() {
      const value = ref(700)
      return { args, value }
    },
    template: '<CreditSlider v-model="value" :disabled="args.disabled" />'
  })
}

// Sample `GET /api/billing/plans → team_credit_stops` payload (DES-197 yearly).
// In production this comes from the API; here it shows the stops being driven
// entirely through props rather than the hardcoded default constant.
const apiTeamCreditStops = {
  default_stop_index: 2,
  stops: [
    {
      id: 'team_200',
      credits: 42_200,
      yearly: { price_cents: 20_000, discount_percent: 0 }
    },
    {
      id: 'team_400',
      credits: 84_400,
      yearly: { price_cents: 38_000, discount_percent: 5 }
    },
    {
      id: 'team_700',
      credits: 147_700,
      yearly: { price_cents: 63_000, discount_percent: 10 }
    },
    {
      id: 'team_1400',
      credits: 295_400,
      yearly: { price_cents: 119_000, discount_percent: 15 }
    },
    {
      id: 'team_2500',
      credits: 527_500,
      yearly: { price_cents: 200_000, discount_percent: 20 }
    }
  ]
}

// Reference adapter (FE-934 will own this in the data layer): API → CreditStop[].
// The pre-discount list price is recovered as discounted / (1 - discount).
const mappedStops = apiTeamCreditStops.stops.map((s) => ({
  credits: s.credits,
  discountPercentYearly: s.yearly.discount_percent,
  usd: Math.round(
    s.yearly.price_cents / 100 / (1 - s.yearly.discount_percent / 100)
  )
}))

export const BackendDrivenStops: Story = {
  name: 'Backend-driven stops (props)',
  render: (args) => ({
    components: { CreditSlider },
    setup() {
      const defaultStopIndex = apiTeamCreditStops.default_stop_index
      const value = ref(mappedStops[defaultStopIndex].usd)
      return { args, value, mappedStops, defaultStopIndex }
    },
    template:
      '<CreditSlider v-model="value" :stops="mappedStops" :default-stop-index="defaultStopIndex" :disabled="args.disabled" />'
  })
}
