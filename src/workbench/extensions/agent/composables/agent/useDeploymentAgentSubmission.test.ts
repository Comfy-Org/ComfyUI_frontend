import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, onTestFinished } from 'vitest'

import { useDeploymentAgentSubmission } from '@/workbench/extensions/agent/composables/agent/useDeploymentAgentSubmission'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useDeploymentAgentStore } from '@/workbench/extensions/agent/stores/agent/deploymentAgentStore'

function setup() {
  const ready = ref(false)
  const target = ref('workflow-a')
  const sent: string[] = []
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  scope.run(() =>
    useDeploymentAgentSubmission({
      targetId: () => target.value,
      visible: () => true,
      ready: () => ready.value,
      submit: async (text) => {
        sent.push(text)
      }
    })
  )
  const composer = useAgentComposerStore()
  composer.setText('Deploy this setup')
  useDeploymentAgentStore().request('workflow-a', 'Deploy this setup')
  return { ready, target, sent, composer }
}

describe('Automatic deployment submission', () => {
  it('waits for the normal session to be ready and submits the requested deployment once', async () => {
    const { ready, sent } = setup()
    await nextTick()
    expect(sent).toEqual([])

    ready.value = true
    await nextTick()
    ready.value = false
    await nextTick()
    ready.value = true
    await nextTick()

    expect(sent).toEqual(['Deploy this setup'])
  })

  it('does not submit a pending deployment after the user edits its draft', async () => {
    const { ready, sent, composer } = setup()
    await nextTick()
    composer.setText('I want to review this')
    await nextTick()
    composer.setText('Deploy this setup')

    ready.value = true
    await nextTick()

    expect(sent).toEqual([])
  })

  it('does not send a pending deployment after the target workflow changes', async () => {
    const { ready, target, sent } = setup()
    await nextTick()
    target.value = 'workflow-b'
    await nextTick()
    target.value = 'workflow-a'

    ready.value = true
    await nextTick()

    expect(sent).toEqual([])
  })
})
