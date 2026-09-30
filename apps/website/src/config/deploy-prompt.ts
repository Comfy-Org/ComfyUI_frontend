import type { Locale } from './locales'

/**
 * The prompt the Ship-in-minutes "Copy prompt" CTA puts on the clipboard,
 * per locale. This deliberately lives outside `translations.ts`: that
 * module is bundled into every page (including `/hub/models/`, which has
 * its own strict script-byte budget), and this prompt is only ever used by
 * `ServerlessDeploySection.vue` on the platform/comfy-api pages.
 */
const DEPLOY_PROMPT: Partial<Record<Locale, string>> = {
  en: `Install comfy-cli and read its build skill:

\`pip install -U comfy-cli\`, then \`comfy skills show comfy-build\`.

It covers packaging a local ComfyUI install — models, custom nodes, dependency pins — into a build on platform.comfy.org and cutting a release. \`comfy skills show comfy-deploy\` covers running that release as a serverless endpoint.`,
  'zh-CN': `安装 comfy-cli，并阅读它的构建技能：

先 \`pip install -U comfy-cli\`，再运行 \`comfy skills show comfy-build\`。

它会把本地 ComfyUI 安装（模型、自定义节点、依赖版本）打包成 platform.comfy.org 上的一个可复现构建，并完成发布。\`comfy skills show comfy-deploy\` 则说明如何把该发布作为无服务器端点运行。`
}

export function deployPromptFor(locale: Locale): string {
  return DEPLOY_PROMPT[locale] ?? DEPLOY_PROMPT.en!
}
