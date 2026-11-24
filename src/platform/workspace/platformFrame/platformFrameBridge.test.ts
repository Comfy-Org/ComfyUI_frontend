import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectPlatformFrame } from './platformFrameBridge'
import type { FrameAccount } from './platformFrameBridge'
import type { FrameMessage, HandedWorkflow } from './platformFrameMessages'

const PLATFORM = 'https://platform.comfy.org'
const NONCE = 'b7b6a3a0-9f0e-4c58-8a51-2f4f6f0f6c11'
const WORKFLOW: HandedWorkflow = {
  filename: 'portrait.json',
  workflow: { nodes: [{ id: 1, type: 'BiRefNet' }] }
}

function framedWindow() {
  const postMessage = vi.fn()
  return { frame: fromPartial<Window>({ postMessage }), postMessage }
}

function account(uid: string | null, token = 'aaa.bbb.ccc'): FrameAccount {
  return { uid: () => uid, idToken: vi.fn(async () => token) }
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function receive(data: unknown, source: Window, origin: string = PLATFORM) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
}

const stops: (() => void)[] = []

function connect(options: {
  frame: Window
  account: FrameAccount
  workflow?: HandedWorkflow | null
  onMessage?: (message: FrameMessage) => void
  onSignInHandoff?: (handedOff: boolean) => void
}) {
  stops.push(
    connectPlatformFrame({
      frame: options.frame,
      platformOrigin: PLATFORM,
      nonce: NONCE,
      workflow: options.workflow ?? null,
      account: options.account,
      onMessage: options.onMessage ?? (() => {}),
      onSignInHandoff: options.onSignInHandoff ?? (() => {})
    })
  )
}

function sentTypes(postMessage: ReturnType<typeof vi.fn>): string[] {
  return postMessage.mock.calls.map(([message]) => message.type)
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('connectPlatformFrame', () => {
  it.for([
    {
      ready: { type: 'ready', signedIn: false },
      sendsToken: true,
      label: 'the frame is signed out'
    },
    {
      ready: { type: 'ready', signedIn: true, userId: 'uid-other' },
      sendsToken: true,
      label: 'the frame is signed in as someone else'
    },
    {
      ready: { type: 'ready', signedIn: true, userId: 'uid-ana' },
      sendsToken: false,
      label: 'the frame is signed in as the same user'
    },
    {
      ready: { type: 'ready', signedIn: true, userId: null },
      sendsToken: false,
      label: 'the frame cannot say who is signed in'
    }
  ])(
    'on ready, sends the token only when needed: $label',
    async ({ ready, sendsToken }) => {
      const { frame, postMessage } = framedWindow()
      connect({ frame, account: account('uid-ana') })

      receive(ready, frame)
      await settle()

      expect(postMessage.mock.calls).toEqual(
        sendsToken
          ? [[{ type: 'sign-in-token', token: 'aaa.bbb.ccc' }, PLATFORM]]
          : []
      )
    }
  )

  it('sends no token when the editor has no signed-in user', async () => {
    const { frame, postMessage } = framedWindow()
    connect({ frame, account: account(null), workflow: WORKFLOW })

    receive({ type: 'ready', signedIn: false }, frame)
    await settle()

    expect(sentTypes(postMessage)).toEqual(['workflow'])
  })

  it('sends the token before the workflow, with a nonce Platform accepts', async () => {
    const { frame, postMessage } = framedWindow()
    connect({ frame, account: account('uid-ana'), workflow: WORKFLOW })

    receive({ type: 'ready', signedIn: false }, frame)

    await settle()

    expect(sentTypes(postMessage)).toEqual(['sign-in-token', 'workflow'])
    const [workflowMessage, target] = postMessage.mock.calls[1]
    expect(target).toBe(PLATFORM)
    expect(workflowMessage).toEqual({
      type: 'workflow',
      nonce: NONCE,
      ...WORKFLOW
    })
    expect(workflowMessage.nonce).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
  })

  it.for([
    {
      label: 'no token comes back',
      account: (): FrameAccount => ({
        uid: () => 'uid-ana',
        idToken: async () => undefined
      })
    },
    {
      label: 'the token request fails',
      account: (): FrameAccount => ({
        uid: () => 'uid-ana',
        idToken: async () => {
          throw new Error('auth/network-request-failed')
        }
      })
    },
    {
      label: 'the editor user changed while it was minted',
      account: (): FrameAccount => {
        let uid = 'uid-ana'
        return {
          uid: () => uid,
          idToken: async () => {
            uid = 'uid-ben'
            return 'aaa.bbb.ccc'
          }
        }
      }
    }
  ])(
    'withholds the workflow from a frame signed in as someone else when $label',
    async ({ account: makeAccount }) => {
      const { frame, postMessage } = framedWindow()
      const onSignInHandoff = vi.fn()
      connect({
        frame,
        account: makeAccount(),
        workflow: WORKFLOW,
        onSignInHandoff
      })

      receive({ type: 'ready', signedIn: true, userId: 'uid-ben' }, frame)
      await settle()

      expect(postMessage).not.toHaveBeenCalled()
      expect(onSignInHandoff.mock.calls).toEqual([[false]])
    }
  )

  it('withholds the workflow from a signed-out frame when no token comes back', async () => {
    const { frame, postMessage } = framedWindow()
    const onSignInHandoff = vi.fn()
    connect({
      frame,
      account: { uid: () => 'uid-ana', idToken: async () => undefined },
      workflow: WORKFLOW,
      onSignInHandoff
    })

    receive({ type: 'ready', signedIn: false }, frame)
    await settle()

    expect(postMessage).not.toHaveBeenCalled()
    expect(onSignInHandoff.mock.calls).toEqual([[false]])
  })

  it('sends the withheld workflow once a later ready gets the token', async () => {
    const { frame, postMessage } = framedWindow()
    const onSignInHandoff = vi.fn()
    const idToken = vi
      .fn<FrameAccount['idToken']>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue('aaa.bbb.ccc')
    connect({
      frame,
      account: { uid: () => 'uid-ana', idToken },
      workflow: WORKFLOW,
      onSignInHandoff
    })

    receive({ type: 'ready', signedIn: true, userId: 'uid-ben' }, frame)
    await settle()
    receive({ type: 'ready', signedIn: true, userId: 'uid-ben' }, frame)
    await settle()

    expect(sentTypes(postMessage)).toEqual(['sign-in-token', 'workflow'])
    expect(onSignInHandoff.mock.calls).toEqual([[false], [true]])
  })

  it('sends the withheld workflow once when Platform later asks for the editor user token', async () => {
    const { frame, postMessage } = framedWindow()
    const onSignInHandoff = vi.fn()
    const idToken = vi
      .fn<FrameAccount['idToken']>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue('aaa.bbb.ccc')
    connect({
      frame,
      account: { uid: () => 'uid-ana', idToken },
      workflow: WORKFLOW,
      onSignInHandoff
    })

    receive({ type: 'ready', signedIn: false }, frame)
    await settle()
    receive({ type: 'token-wanted', userId: 'uid-ana' }, frame)
    await settle()
    receive({ type: 'token-wanted', userId: 'uid-ana' }, frame)
    await settle()

    expect(sentTypes(postMessage)).toEqual([
      'sign-in-token',
      'workflow',
      'sign-in-token'
    ])
    expect(onSignInHandoff.mock.calls).toEqual([[false], [true], [true]])
  })

  it('drops the answer to a ready the frame reloaded past', async () => {
    const { frame, postMessage } = framedWindow()
    const onSignInHandoff = vi.fn()
    const mints: ((token: string | undefined) => void)[] = []
    connect({
      frame,
      account: {
        uid: () => 'uid-ana',
        idToken: () => new Promise((resolve) => mints.push(resolve))
      },
      workflow: WORKFLOW,
      onSignInHandoff
    })

    receive({ type: 'ready', signedIn: false }, frame)
    receive({ type: 'ready', signedIn: false }, frame)
    const [mintBeforeReload, mintAfterReload] = mints
    mintAfterReload('aaa.bbb.ccc')
    await settle()
    mintBeforeReload(undefined)
    await settle()
    receive({ type: 'token-wanted', userId: 'uid-ana' }, frame)
    mints[2]('aaa.bbb.ccc')
    await settle()

    expect(sentTypes(postMessage)).toEqual([
      'sign-in-token',
      'workflow',
      'sign-in-token'
    ])
    expect(onSignInHandoff.mock.calls).toEqual([[true], [true]])
  })

  it('reports nothing once stopped while the token is minted', async () => {
    const { frame, postMessage } = framedWindow()
    const onSignInHandoff = vi.fn()
    let mint: (token: string | undefined) => void = () => {}
    connect({
      frame,
      account: {
        uid: () => 'uid-ana',
        idToken: () => new Promise((resolve) => (mint = resolve))
      },
      workflow: WORKFLOW,
      onSignInHandoff
    })

    receive({ type: 'ready', signedIn: false }, frame)
    for (const stop of stops.splice(0)) stop()
    mint(undefined)
    await settle()

    expect(postMessage).not.toHaveBeenCalled()
    expect(onSignInHandoff).not.toHaveBeenCalled()
  })

  it.for([
    { asked: 'uid-ana', sendsToken: true },
    { asked: 'uid-other', sendsToken: false }
  ])(
    'answers token-wanted for $asked only when that is still the editor user',
    async ({ asked, sendsToken }) => {
      const { frame, postMessage } = framedWindow()
      const user = account('uid-ana', 'new.token.here')
      connect({ frame, account: user })

      receive({ type: 'token-wanted', userId: asked }, frame)
      await settle()

      expect(postMessage.mock.calls).toEqual(
        sendsToken
          ? [[{ type: 'sign-in-token', token: 'new.token.here' }, PLATFORM]]
          : []
      )
      expect(user.idToken).toHaveBeenCalledTimes(sendsToken ? 1 : 0)
    }
  )

  it.for([
    {
      label: 'another origin',
      origin: 'https://evil.example',
      fromFrame: true
    },
    { label: 'another window', origin: PLATFORM, fromFrame: false }
  ])('ignores a message from $label', async ({ origin, fromFrame }) => {
    const { frame, postMessage } = framedWindow()
    const onMessage = vi.fn()
    connect({
      frame,
      account: account('uid-ana'),
      workflow: WORKFLOW,
      onMessage
    })
    const source = fromFrame ? frame : framedWindow().frame

    receive({ type: 'ready', signedIn: false }, source, origin)
    await settle()

    expect(onMessage).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('hands every message it takes to the caller', () => {
    const { frame } = framedWindow()
    const onMessage = vi.fn()
    connect({ frame, account: account('uid-ana'), onMessage })
    const started = {
      type: 'build-started',
      kind: 'new',
      buildId: 'b-1',
      releaseId: 'r-1',
      version: 1,
      deploymentId: 'd-1',
      deploymentName: 'portrait-upscale'
    }

    receive(started, frame)
    receive({ type: 'close' }, frame)

    expect(onMessage).toHaveBeenCalledOnce()
    expect(onMessage).toHaveBeenCalledWith(started)
  })

  it('stops listening once stopped', async () => {
    const { frame, postMessage } = framedWindow()
    const onMessage = vi.fn()
    connect({
      frame,
      account: account('uid-ana'),
      workflow: WORKFLOW,
      onMessage
    })
    for (const stop of stops.splice(0)) stop()

    receive({ type: 'ready', signedIn: false }, frame)
    await settle()

    expect(onMessage).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })
})
