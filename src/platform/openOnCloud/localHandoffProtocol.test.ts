import { afterEach, describe, expect, it } from 'vitest'

import {
  cloudEditorUrl,
  isLocalOrigin
} from '@/platform/openOnCloud/localHandoffProtocol'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

describe(cloudEditorUrl, () => {
  afterEach(() => {
    remoteConfig.value = {}
  })

  it('retains the configured employee rollout override in a new Cloud tab', () => {
    remoteConfig.value = {
      comfy_cloud_base_url:
        'https://fe-pr-22949.testenvs.comfy.org/?ff=open_on_cloud_enabled:true'
    }

    expect(cloudEditorUrl('workflow-transfer')).toBe(
      'https://fe-pr-22949.testenvs.comfy.org/?ff=open_on_cloud_enabled%3Atrue&from_local=workflow-transfer'
    )
  })
})

describe(isLocalOrigin, () => {
  it.for([
    { origin: 'http://localhost:8188', local: true },
    { origin: 'http://127.0.0.1:8000', local: true },
    { origin: 'http://[::1]:8188', local: true },
    { origin: 'http://192.168.1.20:8188', local: true },
    { origin: 'http://10.0.0.5:8188', local: true },
    { origin: 'http://172.20.0.2:8188', local: true },
    { origin: 'https://studio.local', local: true },
    { origin: 'http://172.15.0.2:8188', local: false },
    { origin: 'http://172.32.0.2:8188', local: false },
    { origin: 'http://evillocalhost:8188', local: false },
    { origin: 'ftp://localhost', local: false },
    { origin: 'https://evil.example', local: false },
    { origin: 'https://localhost.evil.example', local: false },
    { origin: 'file://', local: false },
    { origin: 'null', local: false }
  ])('$origin is local: $local', ({ origin, local }) => {
    expect(isLocalOrigin(origin)).toBe(local)
  })
})
