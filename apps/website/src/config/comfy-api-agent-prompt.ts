/**
 * The prompt the Comfy API landing page's "Copy agent prompt" CTA puts on
 * the clipboard, from the "Comfy API Landing Page - September Launch
 * Update" Notion doc. That doc marks this text as a draft pending final
 * copy from its agent-prompt owner, so treat a future wording change here
 * as expected rather than a regression.
 */
export const COMFY_API_AGENT_PROMPT = `Install comfy-cli and read its build skill:

\`pip install -U comfy-cli\`, then \`comfy skills show comfy-build\`.

It covers packaging a local ComfyUI install — models, custom nodes, dependency pins — into a build on platform.comfy.org and cutting a release. \`comfy skills show comfy-deploy\` covers running that release as a serverless endpoint.`
