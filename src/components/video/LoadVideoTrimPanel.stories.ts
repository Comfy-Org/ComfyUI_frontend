import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref, toRefs } from 'vue'

import LoadVideoTrimPanel from './LoadVideoTrimPanel.vue'

const SAMPLE_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

type StoryArgs = ComponentPropsAndSlots<typeof LoadVideoTrimPanel> & {
  trimEnabled?: boolean
  startFrame?: number
  endFrame?: number
}

const meta: Meta<StoryArgs> = {
  title: 'Components/Video/LoadVideoTrimPanel',
  component: LoadVideoTrimPanel,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template:
        '<div class="w-[350px] rounded-2xl bg-node-component-surface p-2"><story /></div>'
    })
  ],
  args: {
    videoUrl: SAMPLE_VIDEO,
    fileSize: 1024 * 1024,
    trimEnabled: false,
    startFrame: 0,
    endFrame: 400
  }
}

export default meta
type Story = StoryObj<typeof meta>

function renderPanel(initialTrimEnabled: boolean) {
  return (args: StoryArgs) => ({
    components: { LoadVideoTrimPanel },
    setup() {
      const { videoUrl, fileSize } = toRefs(args)
      const trimEnabled = ref(initialTrimEnabled)
      const startFrame = ref(args.startFrame ?? 0)
      const endFrame = ref(args.endFrame ?? 400)
      const playheadFrame = ref(0)
      return {
        videoUrl,
        fileSize,
        trimEnabled,
        startFrame,
        endFrame,
        playheadFrame
      }
    },
    template: `
      <LoadVideoTrimPanel
        v-model:trim-enabled="trimEnabled"
        v-model:start-frame="startFrame"
        v-model:end-frame="endFrame"
        v-model:playhead-frame="playheadFrame"
        :video-url="videoUrl"
        :file-size="fileSize"
      />
    `
  })
}

export const TrimDisabled: Story = {
  render: renderPanel(false)
}

export const TrimEnabled: Story = {
  render: renderPanel(true)
}

export const EmptyNoVideo: Story = {
  args: {
    videoUrl: undefined,
    fileSize: undefined
  },
  render: (args) => ({
    components: { LoadVideoTrimPanel },
    setup() {
      const trimEnabled = ref(false)
      const startFrame = ref(0)
      const endFrame = ref(0)
      const playheadFrame = ref(0)
      const uploading = ref(false)
      function handleBrowse() {
        uploading.value = true
        setTimeout(() => {
          uploading.value = false
        }, 1200)
      }
      return {
        args,
        trimEnabled,
        startFrame,
        endFrame,
        playheadFrame,
        uploading,
        handleBrowse
      }
    },
    template: `
      <LoadVideoTrimPanel
        v-model:trim-enabled="trimEnabled"
        v-model:start-frame="startFrame"
        v-model:end-frame="endFrame"
        v-model:playhead-frame="playheadFrame"
        :video-url="args.videoUrl"
        :file-size="args.fileSize"
        :uploading="uploading"
        @browse="handleBrowse"
      />
    `
  })
}

export const EmptyNodeLayout: Story = {
  args: {
    videoUrl: undefined,
    fileSize: undefined
  },
  render: (args) => ({
    components: { LoadVideoTrimPanel },
    setup() {
      const trimEnabled = ref(false)
      const startFrame = ref(0)
      const endFrame = ref(0)
      const playheadFrame = ref(0)
      const uploading = ref(false)
      return {
        args,
        trimEnabled,
        startFrame,
        endFrame,
        playheadFrame,
        uploading
      }
    },
    template: `
      <div class="flex flex-col gap-2">
        <div class="px-2">
          <label class="mb-1 block text-sm text-muted-foreground">video</label>
          <div class="flex h-8 items-center justify-between rounded-lg bg-component-node-widget-background px-2 text-sm text-text-secondary">
            <span>Browse asset library</span>
            <i class="icon-[lucide--chevron-down] size-4 text-component-node-foreground-secondary" />
          </div>
        </div>
        <LoadVideoTrimPanel
          v-model:trim-enabled="trimEnabled"
          v-model:start-frame="startFrame"
          v-model:end-frame="endFrame"
          v-model:playhead-frame="playheadFrame"
          :video-url="args.videoUrl"
          :file-size="args.fileSize"
          :uploading="uploading"
        />
      </div>
    `
  })
}

export const LongVideoManyFrames: Story = {
  args: {
    videoUrl: SAMPLE_VIDEO,
    fileSize: 50 * 1024 * 1024,
    startFrame: 120,
    endFrame: 3600
  },
  render: renderPanel(true)
}
