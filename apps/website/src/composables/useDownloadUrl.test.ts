import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { detectDevice, useDownloadUrl } from './useDownloadUrl'

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  ipadLegacy:
    'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
} as const

describe('detectDevice', () => {
  it.for([
    { label: 'iPhone', ua: UA.iphone },
    { label: 'Android phone', ua: UA.androidPhone },
    { label: 'Android tablet', ua: UA.androidTablet },
    { label: 'iPad with legacy iPad UA', ua: UA.ipadLegacy }
  ])('treats $label as mobile with no platform', ({ ua }) => {
    expect(detectDevice(ua, 5)).toEqual({
      platform: null,
      isMobileUa: true
    })
  })

  it('treats an iPad masquerading as a Mac (touch + Macintosh UA) as mobile', () => {
    expect(detectDevice(UA.ipadDesktopMode, 5)).toEqual({
      platform: null,
      isMobileUa: true
    })
  })

  it('treats a real Mac (no touch points) as a mac desktop', () => {
    expect(detectDevice(UA.mac, 0)).toEqual({
      platform: 'mac',
      isMobileUa: false
    })
  })

  it('treats a Windows touchscreen laptop as a windows desktop', () => {
    expect(detectDevice(UA.windows, 10)).toEqual({
      platform: 'windows',
      isMobileUa: false
    })
  })

  it('treats desktop Linux as an unknown desktop platform', () => {
    expect(detectDevice(UA.linux, 0)).toEqual({
      platform: null,
      isMobileUa: false
    })
  })
})

const DEBUG_RENDERER_INFO = { UNMASKED_RENDERER_WEBGL: 0x9246 }

function reportingCpu(architecture: string): NavigatorUAData {
  return { getHighEntropyValues: async () => ({ architecture }) }
}

function fakeGpu(getParameter: (pname: number) => unknown) {
  const loseContext = vi.fn()
  const webgl = () =>
    fromPartial<WebGLRenderingContext>({
      getExtension: (name: string) => {
        if (name === 'WEBGL_debug_renderer_info') return DEBUG_RENDERER_INFO
        if (name === 'WEBGL_lose_context') return { loseContext }
        return null
      },
      getParameter
    })
  return { webgl, loseContext }
}

function reportingGpu(renderer: string): () => WebGLRenderingContext {
  return fakeGpu((pname) =>
    pname === DEBUG_RENDERER_INFO.UNMASKED_RENDERER_WEBGL ? renderer : null
  ).webgl
}

const NVIDIA_GPU = reportingGpu(
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)'
)

function visitOnWindows(
  userAgentData: NavigatorUAData | undefined,
  webgl: () => WebGLRenderingContext | null
) {
  vi.stubGlobal('navigator', {
    userAgent: UA.windows,
    maxTouchPoints: 0,
    userAgentData
  } satisfies Partial<Navigator>)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(webgl)
}

const DownloadLink = defineComponent({
  setup() {
    const { downloadUrl, platform } = useDownloadUrl()
    return () =>
      platform.value ? h('a', { href: downloadUrl.value }, 'Download') : null
  }
})

describe('useDownloadUrl on Windows', () => {
  it.for([
    {
      label: 'an ARM PC with an NVIDIA GPU',
      cpu: reportingCpu('arm'),
      gpu: NVIDIA_GPU,
      installer: 'arm64'
    },
    {
      label: 'an ARM PC with a Qualcomm GPU',
      cpu: reportingCpu('arm'),
      gpu: reportingGpu(
        'ANGLE (Qualcomm, Qualcomm(R) Adreno(TM) X1-85 GPU (0x0000364E) Direct3D11 vs_5_0 ps_5_0, D3D11)'
      ),
      installer: 'x64'
    },
    {
      label: 'an ARM PC without WebGL',
      cpu: reportingCpu('arm'),
      gpu: () => null,
      installer: 'x64'
    },
    {
      label: 'an ARM PC hiding its GPU renderer',
      cpu: reportingCpu('arm'),
      gpu: () =>
        fromPartial<WebGLRenderingContext>({ getExtension: () => null }),
      installer: 'x64'
    },
    {
      label: 'an ARM PC whose WebGL probe throws',
      cpu: reportingCpu('arm'),
      gpu: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
      installer: 'x64'
    },
    {
      label: 'an x86 PC with an NVIDIA GPU',
      cpu: reportingCpu('x86'),
      gpu: NVIDIA_GPU,
      installer: 'x64'
    },
    {
      label: 'a PC hiding its CPU architecture',
      cpu: reportingCpu(''),
      gpu: NVIDIA_GPU,
      installer: 'x64'
    },
    {
      label: 'a browser without client hints',
      cpu: undefined,
      gpu: NVIDIA_GPU,
      installer: 'x64'
    },
    {
      label: 'a browser rejecting client hints',
      cpu: {
        getHighEntropyValues: () =>
          Promise.reject(new DOMException('blocked', 'NotAllowedError'))
      },
      gpu: NVIDIA_GPU,
      installer: 'x64'
    }
  ])(
    'links $label to the $installer installer',
    async ({ cpu, gpu, installer }) => {
      visitOnWindows(cpu, gpu)

      render(DownloadLink)

      expect(await screen.findByRole('link')).toHaveAttribute(
        'href',
        `https://comfy.org/download/windows/nsis/${installer}`
      )
    }
  )

  it('shows no installer link until the CPU architecture is known', async () => {
    let reportArchitecture!: (hints: { architecture: string }) => void
    visitOnWindows(
      {
        getHighEntropyValues: () =>
          new Promise((resolve) => {
            reportArchitecture = resolve
          })
      },
      NVIDIA_GPU
    )

    render(DownloadLink)
    await nextTick()
    expect(screen.queryByRole('link')).toBeNull()

    reportArchitecture({ architecture: 'arm' })
    expect(await screen.findByRole('link')).toHaveAttribute(
      'href',
      'https://comfy.org/download/windows/nsis/arm64'
    )
  })

  it('never probes the GPU of a PC without an ARM CPU', async () => {
    visitOnWindows(reportingCpu('x86'), NVIDIA_GPU)

    render(DownloadLink)
    await screen.findByRole('link')

    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
  })

  it.for([
    { label: 'reads the renderer', readRenderer: () => 'NVIDIA' },
    {
      label: 'throws reading the renderer',
      readRenderer: () => {
        throw new DOMException('lost', 'InvalidStateError')
      }
    }
  ])(
    'releases the WebGL context when the probe $label',
    async ({ readRenderer }) => {
      const { webgl, loseContext } = fakeGpu(readRenderer)
      visitOnWindows(reportingCpu('arm'), webgl)

      render(DownloadLink)
      await screen.findByRole('link')

      expect(loseContext).toHaveBeenCalledOnce()
    }
  )
})
