import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CodePanel from '../common/CodePanel.vue'
import HeroCode01 from './HeroCode01.vue'

const meta: Meta<typeof HeroCode01> = {
  title: 'Website/Blocks/HeroCode01',
  component: HeroCode01,
  tags: ['autodocs'],
  decorators: [
    // The block colors itself from the page tokens, which default to the dark
    // site. Stamp the subbrand scope so stories match the /developers page.
    () => ({
      template:
        '<div data-page-theme="subbrand" class="bg-page-bg"><story /></div>'
    })
  ],
  args: {
    title: 'Developer platform',
    lead: 'Take the ComfyUI workflow that already works on your machine and run it as an API that scales. Same build, anywhere. Run it on Comfy Cloud or your own serverless deployment, call it from the SDK, and let us manage the build if your team needs it governed.',
    primaryCta: { label: 'Try developer platform', href: '#' },
    secondaryCta: { label: 'Read the doc', href: '#' },
    footnote: 'Beta access is going to teams already running real workloads.'
  }
}

export default meta
type Story = StoryObj<typeof meta>

/** Copy only — the `panel` slot is left empty. */
export const Default: Story = {}

/** The shipping composition: a `CodePanel` fills the slot. */
export const WithCodePanel: Story = {
  render: (args) => ({
    components: { HeroCode01, CodePanel },
    setup: () => ({
      args,
      envs: [
        {
          id: 'cloud',
          label: 'Comfy Cloud',
          languages: [
            {
              id: 'python',
              label: 'Python',
              code: 'from comfy_sdk import Comfy\n\nclient = Comfy(api_key=os.environ["COMFY_API_KEY"])\njob = client.run(wf)',
              html: '<span style="color:#c678dd">from</span> comfy_sdk <span style="color:#c678dd">import</span> Comfy\n\nclient = Comfy(api_key=os.environ[<span style="color:#e5c07b">"COMFY_API_KEY"</span>])\njob = client.run(wf)'
            },
            {
              id: 'curl',
              label: 'cURL',
              code: 'curl -X POST https://cloud.comfy.org/api/v1/run \\\n  -H "Authorization: Bearer $COMFY_API_KEY"'
            }
          ]
        },
        {
          id: 'local',
          label: 'Local',
          languages: [
            {
              id: 'python',
              label: 'Python',
              code: 'os.environ["COMFY_BASE_URL"] = "http://127.0.0.1:8188"'
            }
          ]
        }
      ]
    }),
    template: `
      <HeroCode01 v-bind="args">
        <template #panel>
          <CodePanel
            title="Make your first call"
            subtitle="Uses the Comfy SDK. The cURL tab is the same call over raw HTTP."
            :envs="envs"
            copy-label="Copy"
            copied-label="Copied"
          />
        </template>
      </HeroCode01>
    `
  })
}

/** Primary CTA only, no footnote. */
export const MinimalCtas: Story = {
  args: { secondaryCta: undefined, footnote: undefined }
}
