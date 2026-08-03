// Template: a settings panel using the label-left/control-right row shape
// from reference/patterns/forms.md (Shape 2 -- matches the real app's
// src/components/common/FormItem.vue pattern used in Settings/server config).
// Real components throughout; grouped with a "danger zone" destructive
// section, matching how settings panels in this app separate ordinary
// settings from destructive ones.

import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'
import Switch from '@/components/ui/switch/Switch.vue'

const meta: Meta = {
  title: 'Templates/Settings Panel',
  tags: ['autodocs']
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: { Button, SingleSelect, FormattedNumberStepper, Switch },
    setup() {
      const notifications = ref(true)
      const autoSave = ref(false)
      const theme = ref('system')
      const themeOptions = [
        { name: 'System', value: 'system' },
        { name: 'Light', value: 'light' },
        { name: 'Dark', value: 'dark' }
      ]
      const batchLimit = ref(10)
      return { notifications, autoSave, theme, themeOptions, batchLimit }
    },
    template: `
      <div class="mx-auto flex max-w-md flex-col gap-6 p-6">
        <section class="flex flex-col">
          <h3 class="mb-2 text-sm font-semibold text-base-foreground">General</h3>
          <div class="flex min-h-8 flex-row items-center gap-2 py-1.5">
            <span class="grow text-sm">Enable notifications</span>
            <Switch v-model="notifications" />
          </div>
          <div class="flex min-h-8 flex-row items-center gap-2 py-1.5">
            <span class="grow text-sm">Auto-save workflows</span>
            <Switch v-model="autoSave" />
          </div>
          <div class="flex min-h-8 flex-row items-center gap-2 py-1.5">
            <span class="grow text-sm">Theme</span>
            <SingleSelect v-model="theme" :options="themeOptions" size="md" class="w-32" />
          </div>
          <div class="flex min-h-8 flex-row items-center gap-2 py-1.5">
            <span class="grow text-sm">Max batch size</span>
            <FormattedNumberStepper v-model="batchLimit" :min="1" :max="100" class="w-28" />
          </div>
        </section>

        <section class="flex flex-col gap-2 rounded-lg border border-destructive-background/30 p-4">
          <h3 class="text-sm font-semibold text-destructive-background">Danger zone</h3>
          <p class="text-sm text-muted-foreground">Deleting this workspace removes all of its workflows and cannot be undone.</p>
          <Button variant="destructive" class="w-fit">Delete workspace</Button>
        </section>
      </div>
    `
  })
}
