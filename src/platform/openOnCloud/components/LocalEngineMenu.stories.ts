import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Toaster from '@/components/ui/toast/Toaster.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type {
  CloudWorkflowCheckState,
  PrototypeCloudCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { PROTOTYPE_GAPS } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'

import LocalEngineMenu from './LocalEngineMenu.vue'

/** The Run bar engine menu on local ComfyUI and Desktop, per check state. */
const meta: Meta<typeof LocalEngineMenu> = {
  title: 'Platform/OpenOnCloud/LocalEngineMenu',
  component: LocalEngineMenu,
  tags: ['autodocs'],
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj<typeof meta>

function seeded(
  prototypeCheck: PrototypeCloudCheck,
  state: CloudWorkflowCheckState
): Story {
  return {
    render: () => ({
      components: { LocalEngineMenu },
      setup() {
        const store = useCloudWorkflowCheckStore()
        store.prototypeCheck = prototypeCheck
        store.state = state
      },
      template:
        '<div class="flex h-10 items-center gap-2 floating-panel"><LocalEngineMenu /></div>'
    }),
    play: async ({ canvas, userEvent }) => {
      await userEvent.click(
        canvas.getByRole('button', {
          name: 'Runs on Local. Choose where it runs'
        })
      )
    }
  }
}

export const Checking = seeded('checking', { phase: 'checking', run: 0 })

export const CanOpen = seeded('canOpen', {
  phase: 'answered',
  verdict: { kind: 'canOpen' }
})

export const CantOpen = seeded('missing', {
  phase: 'answered',
  verdict: { kind: 'missing', gaps: PROTOTYPE_GAPS }
})

export const OpenedOnCloud: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => ({
    components: { Toaster },
    setup() {
      const toast = useToast()
      toast.dismissAll()
      toast.info(t('openOnCloud.openedFromLocal'), {
        description: t('openOnCloud.openedFromLocalDetail')
      })
    },
    template: '<div class="h-screen bg-base-background"><Toaster /></div>'
  })
}
