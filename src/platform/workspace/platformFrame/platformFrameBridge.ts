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
}

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
  onMessage
}: PlatformFrameConnection): () => void {
  let connected = true

  function post(message: EditorMessage) {
    if (connected) frame.postMessage(message, platformOrigin)
  }

  async function sendTokenIfWanted(message: FrameMessage) {
    const uid = account.uid()
    if (uid === null || !wantsToken(message, uid)) return
    const token = await account.idToken().catch(() => undefined)
    if (token && account.uid() === uid) post({ type: 'sign-in-token', token })
  }

  async function answerReady(message: FrameMessage) {
    await sendTokenIfWanted(message)
    if (workflow) post({ type: 'workflow', nonce, ...workflow })
  }

  function onWindowMessage(event: MessageEvent) {
    if (event.source !== frame || event.origin !== platformOrigin) return
    const message = readFrameMessage(event.data)
    if (!message) return
    if (message.type === 'ready') void answerReady(message)
    if (message.type === 'token-wanted') void sendTokenIfWanted(message)
    onMessage(message)
  }

  window.addEventListener('message', onWindowMessage)
  return () => {
    connected = false
    window.removeEventListener('message', onWindowMessage)
  }
}
