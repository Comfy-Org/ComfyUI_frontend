import { readFrameMessage } from '@/platform/workspace/platformFrame/platformFrameMessages'
import type {
  EditorMessage,
  FrameMessage,
  HandedWorkflow
} from '@/platform/workspace/platformFrame/platformFrameMessages'

export interface FrameAccount {
  uid: () => string | null
  idToken: () => Promise<string | undefined>
}

export interface PlatformFrameConnection {
  frame: Window
  platformOrigin: string
  nonce: string
  workflow: HandedWorkflow | null
  account: FrameAccount
  onMessage: (message: FrameMessage) => void
  onSignInHandoff: (handedOff: boolean) => void
}

type SignInHandoff = 'not-wanted' | 'sent' | 'failed' | 'superseded'

function wantsToken(message: FrameMessage, uid: string): boolean {
  if (message.type === 'token-wanted') return message.userId === uid
  if (message.type !== 'ready') return false
  if (!message.signedIn) return true
  return message.userId !== null && message.userId !== uid
}

export function connectPlatformFrame({
  frame,
  platformOrigin,
  nonce,
  workflow,
  account,
  onMessage,
  onSignInHandoff
}: PlatformFrameConnection): () => void {
  let connected = true
  let workflowWithheld = false
  let frameLoads = 0

  function post(message: EditorMessage) {
    if (connected) frame.postMessage(message, platformOrigin)
  }

  function report(handedOff: boolean) {
    if (connected) onSignInHandoff(handedOff)
  }

  async function sendTokenIfWanted(
    message: FrameMessage
  ): Promise<SignInHandoff> {
    const uid = account.uid()
    if (uid === null || !wantsToken(message, uid)) return 'not-wanted'
    const load = frameLoads
    const token = await account.idToken().catch(() => undefined)
    if (load !== frameLoads) return 'superseded'
    if (!token || account.uid() !== uid) return 'failed'
    post({ type: 'sign-in-token', token })
    report(true)
    return 'sent'
  }

  function postWorkflow() {
    workflowWithheld = false
    if (workflow) post({ type: 'workflow', nonce, ...workflow })
  }

  async function answerReady(message: FrameMessage) {
    const handoff = await sendTokenIfWanted(message)
    if (handoff === 'superseded') return
    if (handoff !== 'failed') {
      postWorkflow()
      return
    }
    workflowWithheld = true
    report(false)
  }

  async function answerTokenWanted(message: FrameMessage) {
    const handoff = await sendTokenIfWanted(message)
    if (handoff === 'sent' && workflowWithheld) postWorkflow()
  }

  function onWindowMessage(event: MessageEvent) {
    if (event.source !== frame || event.origin !== platformOrigin) return
    const message = readFrameMessage(event.data)
    if (!message) return
    if (message.type === 'ready') {
      frameLoads++
      void answerReady(message)
    }
    if (message.type === 'token-wanted') void answerTokenWanted(message)
    onMessage(message)
  }

  window.addEventListener('message', onWindowMessage)
  return () => {
    connected = false
    window.removeEventListener('message', onWindowMessage)
  }
}
