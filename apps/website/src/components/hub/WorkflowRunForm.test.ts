import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'

import type { AccountCredential } from '@comfyorg/account-core/session'
import { zJobDetailResponse } from '@comfyorg/ingest-types/zod'

import type { RunState } from '../../composables/useWorkflowRun'
import type { WorkflowField } from '../../config/workflow-fields'
import { useWorkshopCredits } from '../../config/workshop-credits'
import { previewScene } from '../../lib/hub/run-preview'
import { RUN_SCENES } from '../../lib/hub/run-scenes'
import WorkflowRunForm from './WorkflowRunForm.vue'

vi.mock(import('../../config/workshop-credits'))
vi.mock(import('../../config/workshop-session-state'))

const credential = {
  token: 't',
  expiresAt: Date.now() + 60_000,
  uid: 'u1',
  workspace: { id: 'w1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
} satisfies AccountCredential

const running = zJobDetailResponse.parse({
  id: '11111111-2222-3333-4444-555555555555',
  status: 'in_progress',
  create_time: 0n,
  update_time: 0n
})

const state = shallowRef<RunState>({ phase: 'idle' })
let balance = ref<ReturnType<typeof useWorkshopCredits>['balance']['value']>({
  status: 'unknown'
})
const inFlight = ref(false)
const signedIn = ref<AccountCredential | undefined>(credential)

// The composable hands the component computed views of its state, so the
// stand-in has to as well or the component reads a different shape.
const busy = computed(() => inFlight.value)
const session = computed(() => signedIn.value)
const settled = computed(() => true)
const run = vi.fn()
const cancel = vi.fn()
const sending = ref(-1)

// The run itself is the composable's, and it has its own tests. What this
// component owes is the questions, the one way to start, and the way out.
vi.mock(import('../../composables/useWorkflowRun'), () => ({
  useWorkflowRun: () => ({
    state,
    values: ref<Record<string, string | number>>({}),
    files: ref({}),
    outputs: ref([]),
    sending,
    busy,
    session,
    settled,
    run,
    resume: vi.fn(),
    cancel
  })
}))

const fields: readonly WorkflowField[] = [
  { node: '1', input: 'image', label: 'Your image', kind: 'image' },
  { node: '2', input: 'prompt', label: 'What to change', kind: 'text' }
]

const graph = {
  '1': { class_type: 'LoadImage', inputs: { image: 'example.png' } },
  '2': { class_type: 'Text', inputs: { prompt: 'make it night' } }
}

const sceneNamed = (name: string) => {
  const found = RUN_SCENES.find((scene) => scene.name === name)
  if (!found) throw new Error(`No scene named ${name}`)
  return found
}

const mount = () => {
  useWorkshopCredits().balance = computed(() => balance.value)
  return render(WorkflowRunForm, { props: { fields, graph } })
}

describe('WorkflowRunForm', () => {
  beforeEach(() => {
    state.value = { phase: 'idle' }
    inFlight.value = false
    signedIn.value = credential
    balance = ref({ status: 'unknown' })
    sending.value = -1
  })

  afterEach(() => {
    previewScene.value = undefined
  })

  it('asks one question per answer the graph needs', () => {
    mount()

    expect(screen.getByRole('group', { name: 'Your image' })).toBeTruthy()
    expect(screen.getByLabelText('What to change')).toBeTruthy()
  })

  it('starts the run when the reader asks for it', async () => {
    mount()

    await userEvent.setup().click(screen.getByTestId('workflow-run-button'))

    expect(run).toHaveBeenCalled()
  })

  // Nothing can be spent until somebody is signed in, so a signed-out reader
  // is offered the way in rather than a button that refuses them.
  it('offers the way in instead of Run when nobody is signed in', () => {
    signedIn.value = undefined
    mount()

    expect(screen.getByTestId('workflow-run-signin')).toBeTruthy()
    expect(screen.queryByTestId('workflow-run-button')).toBeNull()
  })

  it('refuses a second Run while one is already going', () => {
    inFlight.value = true
    mount()

    expect(screen.getByTestId('workflow-run-button').matches(':disabled')).toBe(
      true
    )
  })

  // A queued run is costing something, so there is a way to stop it while it
  // is going and none before it starts.
  it('offers to stop a run only while one is running', () => {
    mount()

    expect(screen.queryByTestId('workflow-run-cancel')).toBeNull()

    state.value = { phase: 'tracking', job: running, startedAt: Date.now() }
    mount()

    expect(screen.getAllByTestId('workflow-run-cancel')).not.toHaveLength(0)
  })

  it('says what went wrong rather than going quiet', () => {
    state.value = {
      phase: 'error',
      reason: 'validation',
      message: 'Cloud could not accept this workflow.',
      retrySafe: false
    }
    mount()

    expect(screen.getByTestId('workflow-run-error').textContent).toContain(
      'Cloud could not accept this workflow.'
    )
  })

  // An empty wallet is worth saying before the files go up, not after: the
  // upload and the wait are spent either way.
  it('asks for credits instead of a run the wallet cannot pay for', () => {
    balance.value = { status: 'ok', credits: 0 }
    mount()

    expect(screen.getByTestId('workflow-run-credits')).toBeTruthy()
    expect(screen.queryByTestId('workflow-run-button')).toBeNull()
    expect(screen.getByTestId('run-gate').textContent).toContain('Personal')
  })

  // Buying for a workspace the reader only belongs to is the owner's to do.
  it('offers the reader their own workspace where the empty one is not theirs', () => {
    signedIn.value = {
      ...credential,
      role: 'member',
      workspace: { id: 'w2', name: 'Comfy Design', type: 'team' }
    }
    balance.value = { status: 'ok', credits: 0 }
    mount()

    expect(screen.getByTestId('workflow-run-personal')).toBeTruthy()
    expect(screen.queryByTestId('workflow-run-credits')).toBeNull()
    expect(screen.getByTestId('run-gate').textContent).toContain('Comfy Design')
  })

  // An upload can take a while, and the panel only says that files are going
  // up. The row the reader is looking at says which one, and which are there.
  it.for([
    { case: 'is on its way up', at: 0, said: 'Going up now…' },
    { case: 'is already there', at: 1, said: 'Uploaded' }
  ])('says when an answer $case', ({ at, said }) => {
    sending.value = at
    mount()

    expect(screen.getByTestId('field-travel-1.image').textContent).toContain(
      said
    )
  })

  it('says nothing about travel while nothing is going up', () => {
    mount()

    expect(screen.queryByTestId('field-travel-1.image')).toBeNull()
  })

  // The states are there to be looked at, and looking costs nothing. Neither
  // being signed out nor an empty wallet stands between a reader and one.
  it.for([
    {
      case: 'nobody is signed in',
      arrange: () => {
        signedIn.value = undefined
      }
    },
    {
      case: 'the wallet is empty',
      arrange: () => {
        balance.value = { status: 'ok', credits: 0 }
      }
    }
  ])('stands a state up although $case', ({ arrange }) => {
    arrange()
    previewScene.value = sceneNamed('Generating')
    mount()

    expect(screen.queryByTestId('workflow-run-signin')).toBeNull()
    expect(screen.queryByTestId('run-gate')).toBeNull()
    expect(screen.getByTestId('workflow-run-button').matches(':disabled')).toBe(
      true
    )
  })

  // A balance that has not arrived is not a balance of nothing.
  it('leaves Run alone while the balance is still unknown', () => {
    mount()

    expect(screen.getByTestId('workflow-run-button')).toBeTruthy()
    expect(screen.queryByTestId('run-gate')).toBeNull()
  })
})
