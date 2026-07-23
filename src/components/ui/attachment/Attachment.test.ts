import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import Attachment from './Attachment.vue'
import AttachmentAction from './AttachmentAction.vue'
import AttachmentActions from './AttachmentActions.vue'
import AttachmentContent from './AttachmentContent.vue'
import AttachmentMedia from './AttachmentMedia.vue'
import AttachmentTitle from './AttachmentTitle.vue'

function renderAttachment(onRemove?: (...args: unknown[]) => void) {
  const Host = defineComponent({
    components: {
      Attachment,
      AttachmentMedia,
      AttachmentContent,
      AttachmentTitle,
      AttachmentActions,
      AttachmentAction
    },
    setup() {
      return { onRemove }
    },
    template: `
      <Attachment size="xs">
        <AttachmentMedia>
          <i data-testid="media-icon" class="icon-[comfy--node]" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>KSampler</AttachmentTitle>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Remove" @click="onRemove">
            <i class="icon-[lucide--x]" />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    `
  })
  return render(Host)
}

describe('Attachment', () => {
  it('renders the title text', () => {
    renderAttachment()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('renders media icon slot content', () => {
    renderAttachment()
    expect(screen.getByTestId('media-icon')).toBeInTheDocument()
  })

  it('emits a click from the action button', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    renderAttachment(onRemove)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })
})
