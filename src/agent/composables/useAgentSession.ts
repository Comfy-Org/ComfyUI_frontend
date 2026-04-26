import { useLocalStorage } from '@vueuse/core'
import type { ModelMessage } from 'ai'
import { shallowRef } from 'vue'

import { useCommandStore } from '@/stores/commandStore'

import type { ToolInvocation } from '../llm/session'
import { streamSession } from '../llm/session'
import { log } from '../services/logger'
import { registerBrowserCommands } from '../shell/commands/browser'
import { registerCodesearchCommands } from '../shell/commands/codesearch'
import { registerComfyCommands } from '../shell/commands/comfy'
import { registerComfyNamespace } from '../shell/commands/comfyNs'
import { registerCoreutils } from '../shell/commands/coreutils'
import { registerExecutionCommands } from '../shell/commands/execution'
import { registerGraphCommands } from '../shell/commands/graph'
import { registerImageCommands } from '../shell/commands/images'
import { registerInstallCommands } from '../shell/commands/install'
import { registerLayoutCommands } from '../shell/commands/layout'
import { registerNodeOpsCommands } from '../shell/commands/nodeOps'
import { registerRegistrySearchCommands } from '../shell/commands/registrySearch'
import { registerSeeCommands } from '../shell/commands/see'
import { registerStateCommands } from '../shell/commands/state'
import { registerSweepCommands } from '../shell/commands/sweep'
import { registerTemplateCommands } from '../shell/commands/templates'
import { registerValidateCommands } from '../shell/commands/validate'
import { registerWorkflowCommands } from '../shell/commands/workflow'
import { CommandRegistryImpl, runScript } from '../shell/runtime'
import type { ExecContext } from '../shell/runtime'
import { collect, emptyIter, stringIter } from '../shell/types'
import type { Command } from '../shell/types'
import { MemoryVFS } from '../shell/vfs/memory'
import { MountedVFS } from '../shell/vfs/mount'
import { UserdataVFS } from '../shell/vfs/userdata'
import type { IngestedAsset } from '../stores/agentStore'
import { useAgentStore } from '../stores/agentStore'

// User's preferred smartest-available model. Override via settings.
const DEFAULT_MODEL = 'gpt-5.4'
const DEFAULT_REASONING_EFFORT = 'high'
const DEFAULT_SYSTEM_APPEND = ''
// Empty by default — the OpenAI SDK falls back to https://api.openai.com.
// User can point this at OpenRouter / a local LLM proxy / a self-hosted
// gateway by overriding via the settings panel.
const DEFAULT_BASE_URL = ''

function buildExecContext(signal: AbortSignal): ExecContext {
  const registry = new CommandRegistryImpl()
  registerCoreutils(registry)
  registerComfyCommands(registry)
  registerComfyNamespace(registry)
  registerStateCommands(registry)
  registerBrowserCommands(registry)
  registerCodesearchCommands(registry)
  registerExecutionCommands(registry)
  registerGraphCommands(registry)
  registerImageCommands(registry)
  registerInstallCommands(registry)
  registerLayoutCommands(registry)
  registerNodeOpsCommands(registry)
  registerRegistrySearchCommands(registry)
  registerSeeCommands(registry)
  registerSweepCommands(registry)
  registerTemplateCommands(registry)
  registerValidateCommands(registry)
  registerWorkflowCommands(registry)

  // Fallback: any Comfy.* (or other registered) command id can be invoked
  // directly as if it were a shell command. Case-insensitive.
  registry.addResolver((name) => {
    const store = useCommandStore()
    const target =
      store.getCommand(name) ??
      store.commands.find((c) => c.id.toLowerCase() === name.toLowerCase())
    if (!target) return undefined
    const handler: Command = async () => {
      try {
        await store.execute(target.id)
        return { stdout: stringIter(`ok: ${target.id}\n`), exitCode: 0 }
      } catch (err) {
        return {
          stdout: emptyIter(),
          exitCode: 1,
          stderr: err instanceof Error ? err.message : String(err)
        }
      }
    }
    return handler
  })

  const vfs = new MountedVFS({
    '/tmp': new MemoryVFS(),
    '/workflows': new UserdataVFS('workflows')
  })
  return {
    registry,
    vfs,
    env: new Map(),
    cwd: '/',
    signal
  }
}

function envApiKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY
  return typeof key === 'string' ? key : ''
}

export function useAgentSession() {
  const store = useAgentStore()
  const apiKey = useLocalStorage('Comfy.Agent.OpenAIKey', envApiKey())
  const model = useLocalStorage('Comfy.Agent.Model', DEFAULT_MODEL)
  const baseURL = useLocalStorage('Comfy.Agent.BaseURL', DEFAULT_BASE_URL)
  const reasoningEffort = useLocalStorage(
    'Comfy.Agent.ReasoningEffort',
    DEFAULT_REASONING_EFFORT
  )
  const systemPromptAppend = useLocalStorage(
    'Comfy.Agent.SystemPromptAppend',
    DEFAULT_SYSTEM_APPEND
  )
  const abortController = shallowRef<AbortController | null>(null)

  function buildHistory(): ModelMessage[] {
    return store.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.text
      }))
  }

  async function send(text: string, assets: IngestedAsset[]): Promise<void> {
    // Abort any in-flight stream from a prior turn so the old callbacks
    // stop writing into the wrong placeholder and the new turn starts
    // from a clean state.
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
      store.isStreaming = false
    }

    const userContent =
      assets.length > 0
        ? `${text}\n\nAttached files:\n${assets.map((a) => `- ${a.path}`).join('\n')}`
        : text
    store.addMessage({ role: 'user', text, assets })

    if (!apiKey.value) {
      store.addMessage({
        role: 'assistant',
        text:
          'No API key configured yet. Click the ⚙ settings gear at the top of this panel and paste an OpenAI or OpenRouter API key. ' +
          "This agent runs entirely in your browser — your key is stored in localStorage and only sent to the API endpoint you configure (default: OpenAI). It's never seen by the ComfyUI frontend or backend."
      })
      return
    }

    const placeholder = store.addMessage({ role: 'assistant', text: '' })
    const ac = new AbortController()
    abortController.value = ac
    store.isStreaming = true

    const history = buildHistory()
    history[history.length - 1] = { role: 'user', content: userContent }

    try {
      let streamed = ''
      const toolCalls: ToolInvocation[] = []
      await streamSession(
        {
          apiKey: apiKey.value,
          model: model.value,
          baseURL: baseURL.value || undefined,
          reasoningEffort: reasoningEffort.value,
          systemPromptAppend: systemPromptAppend.value,
          messages: history,
          execContext: buildExecContext(ac.signal),
          signal: ac.signal
        },
        (delta) => {
          if (ac.signal.aborted) return
          streamed += delta
          placeholder.text = streamed
        },
        (inv) => {
          if (ac.signal.aborted) return
          toolCalls.push(inv)
          const summary = `$ ${inv.script}\n${inv.stdout}${inv.stderr ? `\n[stderr] ${inv.stderr}` : ''}`
          store.addMessage({
            role: 'system',
            text: summary,
            tool: {
              script: inv.script,
              stdout: inv.stdout,
              stderr: inv.stderr,
              exitCode: inv.exitCode
            }
          })
        }
      )
      // Fallback: model ran tools but didn't speak — surface a minimal
      // confirmation so the user isn't staring at tool traces alone.
      if (!ac.signal.aborted && !streamed.trim() && toolCalls.length > 0) {
        const last = toolCalls[toolCalls.length - 1]
        placeholder.text =
          last.exitCode === 0
            ? `(${toolCalls.length} tool call${toolCalls.length > 1 ? 's' : ''} completed)`
            : `(tool exited ${last.exitCode})`
      }
      // Log the FINAL assistant text (agentStore.addMessage only logs the
      // empty placeholder at creation time; we need a follow-up entry so
      // the server log captures what the user actually saw).
      if (!ac.signal.aborted && placeholder.text) {
        log({ kind: 'assistant', text: placeholder.text })
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        placeholder.text =
          'Error: ' + (err instanceof Error ? err.message : String(err))
      }
    } finally {
      // Only clear shared flags if we are still the active stream.
      if (abortController.value === ac) {
        store.isStreaming = false
        abortController.value = null
      }
    }
  }

  function stop(): void {
    abortController.value?.abort()
  }

  let cachedCtx: ExecContext | null = null

  function buildExecContextOnce(): ExecContext {
    if (!cachedCtx) {
      cachedCtx = buildExecContext(new AbortController().signal)
    }
    return cachedCtx
  }

  async function execShell(
    script: string
  ): Promise<{ stdout: string; stderr?: string; exitCode: number }> {
    const ctx = buildExecContextOnce()
    const ac = new AbortController()
    const res = await runScript(script, { ...ctx, signal: ac.signal })
    const stdout = await collect(res.stdout)
    return { stdout, stderr: res.stderr, exitCode: res.exitCode }
  }

  return {
    apiKey,
    baseURL,
    model,
    reasoningEffort,
    systemPromptAppend,
    send,
    stop,
    execShell,
    buildExecContextOnce
  }
}
