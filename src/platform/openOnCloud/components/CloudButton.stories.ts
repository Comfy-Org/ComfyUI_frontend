import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Toaster from '@/components/common/AppToaster.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { CloudWorkflowCheckState } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'

import CloudButton from './CloudButton.vue'
import RunOnCloudDialog from './RunOnCloudDialog.vue'

/** The Run bar's Comfy Cloud button on local ComfyUI and Desktop, and its modals. */
const meta: Meta<typeof CloudButton> = {
  title: 'Platform/OpenOnCloud/CloudButton',
  component: CloudButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj<typeof meta>

const RUN_BAR =
  '<div class="flex h-10 items-center gap-2 floating-panel"><CloudButton /></div>'

function seeded(state: CloudWorkflowCheckState, template: string): Story {
  return {
    render: () => ({
      components: { CloudButton, RunOnCloudDialog },
      setup() {
        useCloudWorkflowCheckStore().state = state
      },
      template
    })
  }
}

export const Idle = seeded({ phase: 'idle' }, RUN_BAR)

export const Checking = seeded(
  { phase: 'checking', run: 0, opensModal: false },
  RUN_BAR
)

export const Ready = seeded(
  { phase: 'answered', verdict: { kind: 'canOpen' }, showsModal: true },
  '<RunOnCloudDialog />'
)

export const SignedOut = seeded(
  { phase: 'answered', verdict: { kind: 'signedOut' }, showsModal: true },
  '<RunOnCloudDialog />'
)

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
    template: '<div class="h-screen bg-background"><Toaster /></div>'
  })
}
