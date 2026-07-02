import type { Page, Route } from '@playwright/test'

import {
  getComboSpecComboOptions,
  isComboInputSpec,
  isComboInputSpecV1
} from '@/schemas/nodeDefSchema'
import type {
  ComboInputSpec,
  ComboInputSpecV2,
  ComfyNodeDef,
  InputSpec
} from '@/schemas/nodeDefSchema'

type ObjectInfoResponse = Record<string, ComfyNodeDef>

type ComboInput = ComboInputSpec | ComboInputSpecV2

const OBJECT_INFO_ROUTE = '**/object_info'

function getRequiredInput(
  objectInfo: ObjectInfoResponse,
  nodeType: string,
  inputName: string
): InputSpec {
  const nodeInfo = objectInfo[nodeType]
  if (!nodeInfo) {
    throw new Error(`Missing object_info entry for ${nodeType}`)
  }

  const requiredInputs = nodeInfo.input?.required
  if (!requiredInputs) {
    throw new Error(`Missing required inputs for ${nodeType}`)
  }

  const input = requiredInputs[inputName]
  if (!input) {
    throw new Error(`Missing input ${nodeType}.${inputName}`)
  }

  return input
}

function getComboInput(
  objectInfo: ObjectInfoResponse,
  nodeType: string,
  inputName: string
): ComboInput {
  const input = getRequiredInput(objectInfo, nodeType, inputName)
  if (isComboInputSpec(input)) {
    return input
  }

  throw new Error(`Expected ${nodeType}.${inputName} to be a combo input`)
}

export function setComboInputOptions(
  objectInfo: ObjectInfoResponse,
  nodeType: string,
  inputName: string,
  values: ReadonlyArray<string | number>
): void {
  const input = getComboInput(objectInfo, nodeType, inputName)
  const nextValues = [...values]

  if (isComboInputSpecV1(input)) {
    input[0] = nextValues
    return
  }

  input[1] = { ...input[1], options: nextValues }
}

export function appendComboInputOptions(
  objectInfo: ObjectInfoResponse,
  nodeType: string,
  inputName: string,
  values: ReadonlyArray<string | number>
): void {
  const input = getComboInput(objectInfo, nodeType, inputName)
  setComboInputOptions(objectInfo, nodeType, inputName, [
    ...getComboSpecComboOptions(input),
    ...values
  ])
}

export async function routeObjectInfoFromSetupApi(
  page: Page,
  customize?: (objectInfo: ObjectInfoResponse) => void | Promise<void>
): Promise<() => Promise<void>> {
  const setupApiUrl =
    process.env.PLAYWRIGHT_SETUP_API_URL ?? 'http://127.0.0.1:8188'
  const objectInfoUrl = new URL('/object_info', setupApiUrl).toString()

  const objectInfoRouteHandler = async (route: Route) => {
    let objectInfo: ObjectInfoResponse
    try {
      const response = await fetch(objectInfoUrl, {
        signal: AbortSignal.timeout(5_000)
      })
      if (!response.ok) {
        await route.fulfill({
          status: response.status,
          contentType: response.headers.get('content-type') ?? 'text/plain',
          body: await response.text()
        })
        return
      }

      objectInfo = (await response.json()) as ObjectInfoResponse
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: `Failed to fetch setup object_info from ${objectInfoUrl}: ${message}`
        })
      })
      return
    }

    await customize?.(objectInfo)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(objectInfo)
    })
  }

  await page.route(OBJECT_INFO_ROUTE, objectInfoRouteHandler)
  return async () => {
    if (page.isClosed()) return
    await page.unroute(OBJECT_INFO_ROUTE, objectInfoRouteHandler)
  }
}
