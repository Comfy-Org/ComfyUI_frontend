import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { workflows } from '../../config/workflow-catalogue'
import { workflowGraphSchema } from '../../config/workflow-execution'
import imageToVideoGraph from '../../data/workflows/video_ltx2_3_i2v.json'
import WorkflowDetail from './WorkflowDetail.vue'

vi.mock(import('../../config/workshop-session-state'), () => ({
  useWorkshopSession: () => ({
    user: computed(() => null),
    session: computed(() => undefined),
    sessionFailure: computed(() => undefined),
    settled: computed(() => true),
    signedIn: computed(() => false),
    ensureFresh: async () => undefined,
    remint: async () => undefined,
    signOut: async () => {}
  })
}))

describe('workflow sign-in', () => {
  it('includes selected files and edited prompts in the Cloud API example', async () => {
    const user = userEvent.setup()
    const workflow = workflows.find((item) => item.slug === 'image-to-video')!
    render(WorkflowDetail, {
      props: { workflow, graph: workflowGraphSchema.parse(imageToVideoGraph) }
    })
    await user.upload(
      screen.getByLabelText('1. Starting image'),
      new File(['image'], 'my-photo.png', { type: 'image/png' })
    )
    const prompt = screen.getByRole('textbox', {
      name: '2. Describe the motion'
    })
    await user.clear(prompt)
    await user.type(prompt, 'Move the camera slowly.')
    await user.click(screen.getByRole('button', { name: 'api' }))
    expect(
      screen.getByText('https://cloud.comfy.org/api/v2/jobs')
    ).toBeVisible()
    expect(screen.getByTestId('workflow-snippet')).toHaveTextContent(
      'my-photo.png'
    )
    expect(screen.getByTestId('workflow-snippet')).toHaveTextContent(
      'Move the camera slowly.'
    )
  })
  it('opens sign-in in the current tab with a return path to the workflow', () => {
    const workflow = workflows.find((item) => item.slug === 'image-to-video')
    if (!workflow) throw new Error('Missing image-to-video workflow')
    render(WorkflowDetail, {
      props: { workflow, graph: workflowGraphSchema.parse(imageToVideoGraph) }
    })
    const signIn = screen.getByRole('link', { name: 'Sign in to run' })
    expect(signIn).toHaveAttribute(
      'href',
      '/login/?returnTo=%2Fmodels%2Fworkflows%2Fimage-to-video%2F'
    )
    expect(signIn).not.toHaveAttribute('target', '_blank')
  })
})
