import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { t } from '@/i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => true
}))

const EXPECTED_PROMPT_EN = `Install comfy-cli and read its build skill:

\`pip install -U comfy-cli\`, then \`comfy skills show comfy-build\`.

It covers packaging a local ComfyUI install — models, custom nodes, dependency pins — into a build on platform.comfy.org and cutting a release. \`comfy skills show comfy-deploy\` covers running that release as a serverless endpoint.`

const EXPECTED_PROMPT_ZH_CN = `安装 comfy-cli，并阅读它的构建技能：

先 \`pip install -U comfy-cli\`，再运行 \`comfy skills show comfy-build\`。

它会把本地 ComfyUI 安装（模型、自定义节点、依赖版本）打包成 platform.comfy.org 上的一个可复现构建，并完成发布。\`comfy skills show comfy-deploy\` 则说明如何把该发布作为无服务器端点运行。`

describe('ServerlessDeploySection', () => {
  it('copies the agent prompt verbatim', async () => {
    const user = userEvent.setup()
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))

    expect(await navigator.clipboard.readText()).toBe(EXPECTED_PROMPT_EN)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })
  it('shows the three deploy commands statically, with no typing cursor', () => {
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: t('platform.serverlessDeploy.shipHeading', {}, { locale: 'en' })
      })
    ).toBeTruthy()
    expect(
      screen.getByText(
        t('platform.serverlessDeploy.shipSubtitle', {}, { locale: 'en' })
      )
    ).toBeTruthy()

    const terminal = screen.getByRole('img', {
      name: t('platform.serverlessDeploy.heading', {}, { locale: 'en' })
    })
    expect(terminal.textContent).toBe(
      '$ comfy build init' +
        '✓ Scanned this ComfyUI install - custom nodes, models, pinned deps' +
        '$ comfy build push --release'
    )
    expect(terminal.textContent).not.toContain('▋')
  })
  it('localizes the prompt for zh-CN', async () => {
    const user = userEvent.setup()
    render(ServerlessDeploySection, { props: { locale: 'zh-CN' } })

    await user.click(screen.getByRole('button', { name: '复制提示词' }))

    expect(await navigator.clipboard.readText()).toBe(EXPECTED_PROMPT_ZH_CN)
  })
})
