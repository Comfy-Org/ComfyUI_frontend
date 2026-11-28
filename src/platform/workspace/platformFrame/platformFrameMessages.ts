export type FrameMessage =
  | { type: 'ready'; signedIn: false }
  | { type: 'ready'; signedIn: true; userId: string | null }
  | { type: 'token-wanted'; userId: string }
  | { type: 'step-shown'; step: 'models' }
  | { type: 'content-height'; height: number | null }
  | {
      type: 'build-started'
      kind: 'new' | 'update'
      buildId: string
      releaseId: string
      version: number
      deploymentId: string
      deploymentName: string
    }
  | {
      type: 'build-progress'
      releaseId: string
      step: number
      of: number
      label: string
    }
  | { type: 'build-failed'; releaseId: string; reason: string }
  | { type: 'deploy-sent'; releaseId: string; deploymentId: string }
  | { type: 'deployment-ready'; deploymentId: string; releaseId: string }
  | {
      type: 'deploy-failed'
      deploymentId: string
      releaseId: string
      reason: string
    }

export interface HandedWorkflow {
  filename: string
  workflow: unknown
}

export type EditorMessage =
  | ({ type: 'workflow'; nonce: string } & HandedWorkflow)
  | { type: 'sign-in-token'; token: string }

type Fields = Record<string, unknown>

function isRecord(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(data: Fields, ...keys: string[]): boolean {
  return keys.every((key) => typeof data[key] === 'string')
}

function counts(data: Fields, ...keys: string[]): boolean {
  return keys.every(
    (key) => typeof data[key] === 'number' && Number.isFinite(data[key])
  )
}

function readReady(data: Fields): FrameMessage | null {
  if (data.signedIn === false) return { type: 'ready', signedIn: false }
  if (data.signedIn !== true) return null
  const userId = data.userId
  if (userId !== null && typeof userId !== 'string') return null
  return { type: 'ready', signedIn: true, userId }
}

function readBuildStarted(data: Fields): FrameMessage | null {
  const kind = data.kind
  if (kind !== 'new' && kind !== 'update') return null
  if (
    !strings(data, 'buildId', 'releaseId', 'deploymentId', 'deploymentName') ||
    !counts(data, 'version')
  )
    return null
  return {
    type: 'build-started',
    kind,
    buildId: String(data.buildId),
    releaseId: String(data.releaseId),
    version: Number(data.version),
    deploymentId: String(data.deploymentId),
    deploymentName: String(data.deploymentName)
  }
}

function readContentHeight(data: Fields): FrameMessage | null {
  const height = data.height
  if (height === null) return { type: 'content-height', height }
  if (!counts(data, 'height') || Number(height) <= 0) return null
  return { type: 'content-height', height: Number(height) }
}

function readBuildProgress(data: Fields): FrameMessage | null {
  if (!strings(data, 'releaseId', 'label') || !counts(data, 'step', 'of'))
    return null
  return {
    type: 'build-progress',
    releaseId: String(data.releaseId),
    step: Number(data.step),
    of: Number(data.of),
    label: String(data.label)
  }
}

function readRelease(data: Fields): FrameMessage | null {
  const type = data.type
  if (type === 'build-failed') {
    if (!strings(data, 'releaseId', 'reason')) return null
    return {
      type,
      releaseId: String(data.releaseId),
      reason: String(data.reason)
    }
  }
  if (!strings(data, 'releaseId', 'deploymentId')) return null
  const releaseId = String(data.releaseId)
  const deploymentId = String(data.deploymentId)
  if (type === 'deploy-failed') {
    if (!strings(data, 'reason')) return null
    return { type, releaseId, deploymentId, reason: String(data.reason) }
  }
  if (type === 'deploy-sent' || type === 'deployment-ready')
    return { type, releaseId, deploymentId }
  return null
}

export function readFrameMessage(data: unknown): FrameMessage | null {
  if (!isRecord(data)) return null
  switch (data.type) {
    case 'ready':
      return readReady(data)
    case 'token-wanted':
      return strings(data, 'userId')
        ? { type: 'token-wanted', userId: String(data.userId) }
        : null
    case 'step-shown':
      return data.step === 'models'
        ? { type: 'step-shown', step: 'models' }
        : null
    case 'content-height':
      return readContentHeight(data)
    case 'build-started':
      return readBuildStarted(data)
    case 'build-progress':
      return readBuildProgress(data)
    default:
      return readRelease(data)
  }
}
