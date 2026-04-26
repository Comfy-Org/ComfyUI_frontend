import { createOpenAI } from '@ai-sdk/openai'
import type { ModelMessage } from 'ai'
import { stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'

import { runScript } from '../shell/runtime'
import type { ExecContext } from '../shell/runtime'
import { collect } from '../shell/types'

/**
 * Phrases that signal the model promised follow-up action without
 * executing it. Triggered programmatically — far more reliable than
 * adding more "do not say this" rules to the system prompt, which
 * the model regularly violates.
 */
const PROMISSORY_PATTERN =
  /\b(let'?s try|let me (try|investigate|check|explore|re-?examine|verify|look)|i'?ll (try|explore|investigate|check|re-?try|re-?run)|another approach|trying (a different|another)|let me approach|could you|continue investigating|let me run|i need to (check|run|investigate))\b/i

/**
 * Up to this many extra streamText calls per send() to recover from
 * promissory-stop. Caps the cost: the agent can't burn unlimited
 * tokens looping on itself.
 */
const MAX_AUTOCONTINUE = 3

/**
 * Layer 1 guardrail: shell-idiom blocklist.
 *
 * Empirically these patterns lead the agent to confidently-wrong answers
 * because their semantics are subtle and easy to misread. We reject them
 * pre-execution and tell the model what to use instead. Cheaper than
 * letting the agent commit to a bad conclusion based on the output.
 */
interface ShellIdiomCheck {
  pattern: RegExp
  reason: string
  alternative: string
}
const FRAGILE_SHELL_IDIOMS: ShellIdiomCheck[] = [
  {
    pattern: /\bgrep\s+(-[a-zA-Z]*q[a-zA-Z]*|--quiet)\b/,
    reason:
      "'grep -q' is silent on success and exits 1 on no-match — the model regularly misreads its empty stdout as 'no matches found'.",
    alternative:
      "Use 'grep' WITHOUT -q (so output is visible) and reason from the actual matched lines, OR use 'run-js' with an explicit return value when the question is structured."
  },
  {
    pattern: /\b(graph\s+json|run-js[^|]*JSON\.stringify)[^|]*\|\s*grep\b/,
    reason:
      "Using 'grep' to interrogate structured JSON is too imprecise to base an answer on — keys, values, and whitespace all match the same patterns.",
    alternative:
      'Use \'run-js\' with a typed filter that returns the answer directly. Example: "run-js return useCanvasStore().canvas.graph._nodes.filter(n => /* predicate */).map(n => n.id)".'
  },
  {
    pattern: /\|\s*head\s+(-[0-9n]+\s+)?-?1\s*$/,
    reason:
      "'head -1' as the final stage of a pipe assumes the stdout is ordered for your purpose — usually it isn't, and the answer becomes whichever line happened to come first.",
    alternative:
      "Use 'run-js' with explicit selection (e.g. .find(...) or sort+pick). If you only want a count, use .length on the filtered array."
  }
]

function vetScript(
  script: string
): { ok: true } | { ok: false; error: string } {
  const trimmed = script.trim()
  for (const idiom of FRAGILE_SHELL_IDIOMS) {
    if (idiom.pattern.test(trimmed)) {
      return {
        ok: false,
        error:
          'script rejected by guardrail: ' +
          idiom.reason +
          '\n\nUse this instead: ' +
          idiom.alternative +
          '\n\n(This is a runtime check, not a model preference. Your next tool call should use the alternative.)'
      }
    }
  }
  return { ok: true }
}

/**
 * Layer 2 guardrail: definitive-claim verifier.
 *
 * Once streamText returns the final assistant text, scan it for
 * definitive factual claims about the workflow / graph state. For each
 * matched claim, run an independent verification query and compare. If
 * the verification disagrees with the claim, force a re-stream with a
 * contradiction nudge — instead of letting the user receive a confident
 * but unverified (potentially wrong) answer.
 *
 * This is necessarily heuristic: we can only verify claims whose shape
 * we know how to derive. The matchers below cover the common cases that
 * have produced wrong answers in this session.
 */
interface ClaimVerifier {
  match: RegExp
  /** A run-js script that derives the ground truth. */
  derive: string
  /**
   * Given the derive script's stdout, decide whether the claim text
   * is consistent with reality. Returns null if consistent, or a
   * short reason string if not.
   */
  judge: (claimText: string, deriveStdout: string) => string | null
}

/** Map English number words 0–20 to digits, plus the digit form. */
function parseCountFromText(s: string): number | null {
  const lower = s.toLowerCase()
  const words: Record<string, number> = {
    zero: 0,
    no: 0,
    none: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20
  }
  // Match: "<number> orphan" — number is digit or word
  const re =
    /\b(zero|no|none|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+)\s+orphan/i
  const m = lower.match(re)
  if (!m) return null
  const tok = m[1].toLowerCase()
  if (/^\d+$/.test(tok)) return Number(tok)
  return words[tok] ?? null
}

const ORPHAN_DERIVE =
  'run-js const g = useCanvasStore().canvas.graph; const N = g._nodes; const L = Array.isArray(g.links) ? g.links : Object.values(g.links); const linked = new Set(); for (const l of L) { if (l) { linked.add(l.origin_id); linked.add(l.target_id); } } return N.filter(n => !linked.has(n.id)).map(n => n.id);'

const CLAIM_VERIFIERS: ClaimVerifier[] = [
  {
    // Any answer mentioning "orphan" — covers "no orphans", "5 orphan
    // nodes", "found two orphans", "list of orphan IDs", etc. Always
    // re-derive the truth and compare both count and ID set.
    match: /\borphan/i,
    derive: ORPHAN_DERIVE,
    judge: (text, stdout) => {
      let actualIds: number[]
      try {
        const parsed = JSON.parse(stdout.trim())
        if (!Array.isArray(parsed)) return null
        actualIds = parsed.map((x: unknown) => Number(x))
      } catch {
        return null
      }
      const actualCount = actualIds.length
      const actualSet = new Set(actualIds)

      // Check claimed count against derived count.
      const claimedCount = parseCountFromText(text)
      if (claimedCount !== null && claimedCount !== actualCount) {
        return `claim says ${claimedCount} orphan(s), verifier counted ${actualCount}: ${JSON.stringify(actualIds)}`
      }

      // Check any claimed IDs (e.g. "ID: 15", "node 19") against the
      // actual orphan set. Any over-claim is a contradiction.
      const idMatches = [...text.matchAll(/\b(?:node|id)[:\s]*(\d+)\b/gi)]
      const claimedIds = idMatches.map((m) => Number(m[1]))
      const overClaimed = claimedIds.filter(
        (id) => Number.isFinite(id) && !actualSet.has(id)
      )
      if (overClaimed.length > 0) {
        return `claim lists node id(s) ${JSON.stringify(overClaimed)} as orphan but verifier disagrees; actual orphan ids: ${JSON.stringify(actualIds)}`
      }

      // "no orphan nodes" / "all connected" while there ARE orphans.
      const negative =
        /\b(no\s+orphan|0\s+orphan|none\s+orphan|all\s+nodes\s+are\s+(?:inter)?connected|nodes\s+are\s+(?:fully\s+)?connected\s+properly|all\s+nodes\s+are\s+linked|no\s+disconnected)/i.test(
          text
        )
      if (negative && actualCount > 0) {
        return `claim says no orphans, verifier found ${actualCount}: ${JSON.stringify(actualIds)}`
      }
      return null
    }
  },
  {
    // "no missing models" / "all models are present"
    match:
      /\b(no\s+missing\s+model|all\s+(?:required\s+)?models\s+(?:are\s+)?(?:present|installed|available))/i,
    derive: 'run-js return useMissingModelStore().missingModels?.length ?? 0;',
    judge: (_text, stdout) => {
      const n = Number(stdout.trim())
      if (!Number.isFinite(n)) return null
      if (n > 0) return `verifier reports ${n} missing model(s)`
      return null
    }
  },
  {
    // "queue started" / "image generation in progress" / "queued, should
    // soon start" — agent regularly mistakes the queueprompt ack for a
    // real run start, even when validation rejected the prompt and the
    // queue stays empty. Cross-check against actual queue state +
    // workflow-errors before letting the claim through.
    match:
      /\b(?:(?:queue|job|process|generation|prompt|workflow|run)\s+(?:has\s+been\s+|is\s+|will\s+|should\s+(?:soon\s+)?)?(?:now\s+)?(?:successfully\s+)?(?:started|queued|running|processing|underway|in\s+progress|begin)|(?:has\s+|been\s+)?started\s+successfully|image\s+(?:will|should)\s+(?:appear|be\s+(?:generated|created|produced|ready)|show|complete)|you(?:'ll|\s+will|\s+should)\s+(?:see|find|get)\s+(?:the\s+|your\s+)?(?:generated\s+|new\s+|resulting\s+|final\s+)?(?:image|result|output|file|render)|once\s+(?:it'?s\s+|the\s+(?:job|generation|process)\s+is\s+)?(?:complete|done|finished)|(?:running|processing)\s+now\b)/i,
    // Use the existing shell commands so we don't reinvent store access.
    // queue-status emits 'running: N\n  ...\npending: N\n', workflow-errors
    // emits either 'no errors' or 'errors detected'.
    derive: 'queue-status; echo ---; workflow-errors',
    judge: (_text, stdout) => {
      const runningMatch = stdout.match(/^running:\s*(\d+)/m)
      const pendingMatch = stdout.match(/^pending:\s*(\d+)/m)
      const running = runningMatch ? Number(runningMatch[1]) : null
      const pending = pendingMatch ? Number(pendingMatch[1]) : null
      const hasErrors = /errors\s+detected/i.test(stdout)
      if (hasErrors) {
        return 'claim says queue/generation started but workflow-errors reports validation errors — the queueprompt was likely rejected before running'
      }
      if (running === 0 && pending === 0) {
        return 'claim says queue/generation started but queue-status shows running=0 pending=0. Either validation rejected the prompt or it finished instantly. Use missing-models / workflow-errors / graph node to investigate before reasserting.'
      }
      return null
    }
  },
  {
    // Pre-refusal: "doesn't seem available", "not available in this
    // setup", "requires X which isn't here". Forbidden by prompt rules
    // ("ZERO-TOOL REFUSAL IS FORBIDDEN") but the model violates them
    // when it pattern-matches a refusal as the polite response.
    // Pure code-side trigger — judge always returns a contradiction so
    // the auto-continue forces the model to actually try.
    match:
      /\b(doesn'?t\s+seem\s+(?:to\s+be\s+)?available|not\s+available\s+in\s+this\s+setup|seems?\s+(?:to\s+be\s+)?(?:disabled|missing|unavailable)|doesn'?t\s+(?:appear|look)\s+to\s+be\s+(?:available|enabled|present)|(?:requires|needs)\s+.{1,80}?\s+which\s+(?:isn'?t|doesn'?t\s+seem|doesn'?t\s+appear))\b/i,
    // No real derivation — emit a tautology so the judge can read it.
    derive: 'run-js return "force-retry";',
    judge: (_text, stdout) => {
      if (!stdout.includes('force-retry')) return null
      return 'agent refused based on assumption ("not available" / "doesn\'t seem to be") without first ATTEMPTING the call. Run the tool and let the actual error surface; do not pre-judge availability.'
    }
  },
  {
    // "Punt to user" pattern: the agent hands the work back instead of
    // doing it. Common phrasings: "you can try ...", "please review ...",
    // "if everything seems ...", "let me know if you need ...". Triggers
    // when a definitive task was given but the response is passive.
    match:
      /\b(you\s+can\s+(?:try|review|check|verify|look)|please\s+(?:review|check|try|verify)|if\s+(?:everything|the\s+workflow|all)\s+(?:seems?|looks?|appears?)|once\s+(?:resolved|fixed|done)\s+you\s+can|let\s+me\s+know\s+if\s+you\s+(?:need|want|have))\b/i,
    derive: 'run-js return "punt-detected";',
    judge: (text, stdout) => {
      if (!stdout.includes('punt-detected')) return null
      // Don't fire if the agent is genuinely awaiting clarification
      // (presence of a question mark suggests they're asking, not punting).
      if (/\?\s*$/m.test(text.trim())) return null
      return 'agent deferred the task to the user instead of completing it. Take the next concrete step yourself; the user expects the agent to finish, not to point at the UI.'
    }
  }
]

interface ClaimCheckResult {
  contradiction: string
  verifier: ClaimVerifier
  deriveResult: string
}

async function verifyClaims(
  finalText: string,
  runOne: (script: string) => Promise<{ stdout: string; exitCode: number }>
): Promise<ClaimCheckResult | null> {
  for (const v of CLAIM_VERIFIERS) {
    if (!v.match.test(finalText)) continue
    let result
    try {
      result = await runOne(v.derive)
    } catch {
      continue
    }
    if (result.exitCode !== 0) continue
    const verdict = v.judge(finalText, result.stdout)
    if (verdict) {
      return {
        contradiction: verdict,
        verifier: v,
        deriveResult: result.stdout
      }
    }
  }
  return null
}

const SYSTEM_PROMPT = `You operate ComfyUI through a POSIX-like shell running in the user's browser.

THE ONLY EXISTING MOUNTS ARE:
  /tmp         in-memory scratch, this session only
  /workflows   the user's saved workflow files (backed by the ComfyUI userdata API)

DO NOT reference any other path. /userdata /mnt /home /opt /models /input /output /var — none of these exist.
If you need something that is not under the mounts above, say so explicitly instead of guessing.

THE ONLY BUILT-IN COMMANDS ARE:
  coreutils:  ls cat echo grep head tail wc pwd true false seq
  browser:    run-js <expr>       evaluate JS in the browser window
              describe <expr>     introspect the shape of a value: type, own
                                  properties, prototype methods. Use THIS
                                  before writing a run-js mutation against an
                                  unknown object. Example:
                                    describe useCanvasStore().canvas.graph
  comfy UI commands:
    - \`comfy\`                          list top-level namespaces
    - \`comfy canvas\`                   list Canvas.* subcommands
    - \`comfy canvas fitview\`           execute Comfy.Canvas.FitView
    - \`comfy canvas fitview --help\`    detailed usage (label, tooltip, shortcut)
    - All Comfy.* ids also run directly, case-insensitive.
    - Discovery:  cmd-list '<regex>'    (legacy; prefer 'comfy <ns>')
    Examples: Comfy.Canvas.FitView, comfy queueprompt, comfy canvas selectall
  state:      missing-models         same data the "missing models" banner uses
              workflow-errors        summary of current workflow errors
              active-workflow        path + modified/persisted flags
              show-errors            open the right-side errors panel for the user
              show-missing-models    open the errors panel focused on missing models
              help                   the full built-in list
  graph:      graph summary          node count + per-type breakdown of the active graph
              graph nodes [regex]    id / type / title of nodes (optionally type-filtered)
              graph node <id>        full node summary (inputs, outputs, widgets)
              graph json             full graph as JSON (may be large — pipe to head)
              set-widget <id> <name> <value>   set a widget on a node (numeric/boolean coerced)
  queue:      queue-status           running + pending jobs
              history [--last=N]     recent completions (default 10, max 200)
              wait-queue [--timeout=N --poll=M]  block until queue drains (seconds)
              latest-output          metadata + view URLs for the most recent job's images
  workflow:   save-as <name>          save the active workflow with <name>,
                                      NON-INTERACTIVELY (no modal). Use this
                                      instead of Comfy.SaveWorkflowAs when the
                                      user gives a filename — SaveWorkflowAs
                                      opens a modal prompt that blocks tools.
              new-workflow [name]     Comfy.NewBlankWorkflow; if <name> is
                                      given, immediately save-as <name>.
                                      Use for "create a new workflow named X".
              rename-workflow <name>  Rename the active persisted workflow
                                      without opening a modal. Bypass for
                                      Comfy.RenameWorkflow.
              clear-workflow --force  Clear the active workflow without the
                                      native confirm() dialog. Bypass for
                                      Comfy.ClearWorkflow (--force required).
              set-subgraph-desc <text...>
                                      Set description on the open subgraph.
                                      Bypass for Comfy.Subgraph.SetDescription.
              set-subgraph-aliases <a1> [a2 ...]
                                      Set search aliases on the open subgraph.
                                      Bypass for Comfy.Subgraph.SetSearchAliases.
  nodeops:    node-search <pattern>   List registered node types matching the
                                      pattern (regex or substring, case-
                                      insensitive). Use BEFORE add-node.
              add-node <type> [x] [y] Create a node of <type> and add to the
                                      active graph. Prints the new node id.
                                      If <type> is unknown, use node-search.
                                      When [x y] is omitted, auto-places at
                                      a non-overlapping spot near the current
                                      viewport center. PREFER omitting [x y]
                                      when adding multiple nodes — the LLM
                                      should NOT invent coordinates.
              align-nodes <axis>      Align selected nodes. axis ∈
                                      { left, right, center-x,
                                        top, bottom, center-y }.
              distribute-nodes <h|v>  Space selected nodes evenly (needs ≥3).
              toggle-panel <name>     Open/close a side panel by name.
                                      Right-side tabs: parameters, nodes,
                                      settings, info, subgraph, errors.
                                      Left sidebar tabs: assets, node-library,
                                      model-library (alias: models), workflows,
                                      apps. Aliases: missing-models→errors.
                                      Special overlays (routed via command):
                                      queue, history (job-history).
              select <spec...>        Select nodes. Accepts: ids ('select 3 5'),
                                      type filter ('select type=KSampler'),
                                      'all', or 'none'. Required before
                                      align-nodes / distribute-nodes.
              connect <from> <to>     Link sockets. Format: <id>.<output>
                                      <id>.<input>. Sockets by index (0-based)
                                      or name. Example: 'connect 3.0 5.0' or
                                      'connect 3.LATENT 5.samples'. After a
                                      successful link the graph auto-lays out
                                      (LR tree). Pass --no-layout to suppress.
              layout [lr|tb]          Manually run the tree layout. Call after
                                      bulk add-node / before save to tidy.
              disconnect <id>.<input> Remove the link feeding an input socket.
                                      Auto-layouts after (--no-layout to skip).
              remove-node <id...>     Delete nodes by id. Auto-layouts after.
              get-widget <id> <name>  Read a widget's current value
                                      (complements set-widget).
  vision:     see [<question...>]      Take a screenshot of the current
                                      ComfyUI canvas, send to Gemini for
                                      analysis. Use to verify a workflow
                                      is wired correctly, spot disconnected
                                      sockets / red error frames, or check
                                      that a Preview3D / PreviewImage node
                                      actually rendered. Default question:
                                      describe what is on the canvas.
                                      Requires Comfy Cloud sign-in.
  validate:   validate <output_file> [<question...>]
                                      Run gemini-3-1-pro on an image in
                                      output/ to evaluate quality. Default
                                      question asks for a 1-5 rating. Use
                                      AFTER every SaveImage to confirm the
                                      result matches intent BEFORE starting
                                      next-phase work (e.g. image-to-3D).
                                      Requires Comfy Cloud sign-in.
  images:     copy-to-input <output_file> [as <input_file>]
                                      Copy a file from output/ into input/
                                      so the next workflow can use it via
                                      LoadImage. Required between phases
                                      of a chained pipeline (T2I → I23D etc).
              latest-output-name      Print the filename of the most recent
                                      SaveImage / SaveGLB output. Feed into
                                      copy-to-input in compound calls.
  install:    install-model <url> <type>/<filename>
                                      Queue a model download via ComfyUI-Manager.
                                      Example: install-model https://x/y.safetensors
                                      checkpoints/y.safetensors. Types:
                                      checkpoints, loras, vae, clip, unet,
                                      controlnet, upscale_models, embeddings,
                                      ipadapter, clip_vision. Requires Manager.
              install-status          Show manager install queue + recent
                                      history. Use to check download progress.
  templates:  templates [filter]      List built-in workflow templates (name
                                      + module). Use this FIRST when the user
                                      asks for a workflow you don't know how
                                      to build from scratch (e.g. 3D, video,
                                      controlnet, upscale). Output line
                                      format: '<moduleName>/<id> — <title>'.
              load-template <mod> <id> Load a template into the active canvas.
                                      Replaces the current workflow. Get
                                      <mod>/<id> from the 'templates' output.
  sweep:      sweep <nodeId> <widgetName> <v1> [<v2> ...]
                Sets widget to each value, queues, waits for idle, repeats.
                Example: sweep 3 cfg 5 6 7 8  (four CFG values sequentially)
                sweep-help  — show full usage

No other commands exist. Do not invent binaries (no "curl", "wget", "python", "git", "ffmpeg", "comfy-manager"). If you need a capability that is not in this list, say so.

Rules:
- ZERO-TOOL REFUSAL IS FORBIDDEN. You MUST NOT answer "not directly
  supported" / "isn't possible" / "I can't" / "ありません" / "できません"
  until you have run at least ONE tool call that proves the capability
  is missing. Mandatory discovery before refusing:
    1. For any node-related intent ("add a X node", "find Y node"):
       FIRST try 'node-search <pattern>' — there are thousands of
       registered node types, most are custom and not in any Comfy.*
       command. Examples:
         "add a nano banana node"   → node-search banana
         "add a KSampler"           → node-search KSampler
         "find loaders"             → node-search loader
    2. For any UI/panel/view intent ("show me X", "open Y panel",
       "bring me to Z"): FIRST try 'toggle-panel <name>' with the
       most likely alias, OR 'cmd-list <keyword1> <keyword2> …'.
       Examples:
         "show the queue panel"        → toggle-panel queue
         "bring me to the side panel"  → cmd-list sidepanel sidebar panel
    3. For workflow/canvas/command intents: 'cmd-list <k1> <k2> …'
       with 2+ spellings of the intent.
    4. If all of those return empty:
       'run-js return useCommandStore().commands.map(c=>c.id)' to enumerate.
  Only AFTER those return empty may you say the feature is absent.
  When anything matches, invoke it — do NOT just describe it.
- Use run_shell to execute. Chain with | && || ; and redirect with > and >>.
- Prefer one compound run_shell call over many round trips.
- The \`script\` field of run_shell MUST be a valid shell command — NEVER
  paste the user's natural-language sentence into it. Translate first.
  BAD:   run_shell("connect node 4 latent output to ksampler latent_image")
  GOOD:  run_shell("connect 4.LATENT 5.latent_image")
- Before 'connect'ing to an unfamiliar node type, run 'graph node <id>' to
  learn the exact socket names. Do NOT invent socket names from position
  (e.g. KSampler's inputs are 'model positive negative latent_image' —
  there is no 'clip' or 'latent' on KSampler). Introspect first, wire
  second. One 'graph node' call per unfamiliar node is enough.
- Image generation intents ("give me X", "generate Y", "make me a Z image"):
  this means UPDATE the positive prompt and QUEUE, not just queue. Recipe:
    1. Find the positive CLIPTextEncode: it's the one linked to the
       KSampler's 'positive' input. 'run-js' or 'graph node <KSamplerId>'
       reveals it.
    2. 'set-widget <positiveId> text "<the described subject>"'
    3. Optionally set negative prompt if the user specified what to avoid.
    4. 'comfy queueprompt' to run. 'queue-status' to verify it's running.
  Do NOT queue without updating the prompt first — the output would ignore
  the user's request.
- Any argument containing |, &, ;, (, ), <, >, or whitespace MUST be quoted.
  'cmd-list' accepts MULTIPLE positional patterns (OR'd), so prefer:
     cmd-list canvas arrange align    # three patterns, no quoting needed
  Do NOT write: cmd-list canvas|arrange|align  (| is a shell pipe)
- Before destructive writes/deletes, read or list first.
- No command substitution $(...), no globs, no heredocs, no subshells.
- Short / vague messages ('hello', 'wat') get a 1-2 sentence acknowledgement.

Decision flow for a user request:
  1. Is there a registered Comfy.* command for the intent?
       → try 'comfy <ns>' first (e.g. 'comfy canvas' for layout intents),
         or 'cmd-list <keywords…>' with multiple positional patterns.
       → if a leaf exists, invoke it directly: Comfy.Canvas.FitView, etc.
  2. Is the intent a geometry / position / size change?
       → use node-list, node-pos, node-size, apply-layout. The recipe
         below shows a full topological tree layout in one run-js call.
  3. Is the intent a state inspection?
       → missing-models, workflow-errors, graph summary, queue-status,
         latest-output, history.
  4. Does it involve arbitrary DOM / store / canvas access?
       → run-js '<code>'. You have window.app, document, and any
         imported pinia store via its global (useCanvasStore, etc.).
  5. Genuinely unsupported?
       → say so plainly in one sentence; offer to try run-js or to stop.
  Never loop two vague menus in a row. If a 'cmd-list' returns nothing,
  pivot to node-list / apply-layout / run-js, don't repeat discovery.

run-js is the universal fallback. These locals are PRE-INJECTED into every
run-js call — just use them by name, do NOT import, do NOT use require:
  app, api, document, window,
  useCanvasStore, useCommandStore, useWorkflowStore,
  useMissingModelStore, useExecutionErrorStore, useSettingStore
Shortcuts (most common):
  const g = useCanvasStore().canvas.graph            // the live LGraph
  g._nodes                                           // node array
  g.links  // either array or map — normalise:
  const L = Array.isArray(g.links) ? g.links : Object.values(g.links)

When no registered command matches the intent, reach for run-js directly.
Always capture undo after a graph mutation:
  useWorkflowStore().activeWorkflow?.changeTracker?.checkState()

Iteration / self-correction rules (CRITICAL):
- NEVER claim success without working evidence. Before the final reply
  that announces "done", run ONE concrete verification step whose output
  proves the user's goal was reached. Examples of working evidence:
    * Layout: 'node-list --json | head' showing the new pos values, or
      run-js 'return useCanvasStore().canvas.graph._nodes.map(n => [n.id, n.pos])'.
    * Queue: 'queue-status' showing the job is running / finished.
    * Missing model fixed: 'missing-models' returning '0 missing'.
    * Widget change: 'graph node <id>' with the new value visible.
    * Settings change: 'run-js useSettingStore().get("Comfy.Foo")' == target.
  If the evidence contradicts the expectation, iterate again instead of
  replying.
- Keep working until the user's ORIGINAL goal is achieved. Do not stop
  after the first attempt. The step budget is effectively unlimited.
- If a run-js call throws, READ the error message and immediately retry
  with a corrected snippet in the SAME turn — no asking permission.
  Phrases that MUST be followed by another tool call in the same turn,
  not by a stop:
    "Let's try another approach"
    "Let me try a different way"
    "I'll explore this further"
    "Let me investigate"
    "Let me check"
    "I'll re-examine"
    Any sentence ending with ":" or "..." that promises future action
  If you write any of these, the very next tokens MUST be a run_shell
  tool call. Stopping after such a sentence is forbidden — it leaves
  the user staring at an error with no resolution.
- Final answer narration rule: every turn that runs tools MUST end with
  a 1-3 sentence plain-language summary of what you found, separate
  from the tool output. Tool output alone is not an answer. Examples:
    GOOD: "Found 2 orphan nodes: id 15 (MarkdownNote — looks
           intentional, just documentation) and id 19 (Preview3D — has
           model_file widget set but no upstream link)."
    BAD: just leaving the JSON [15, 19] visible in the tool output and
         going silent. The user shouldn't have to decode raw output.
- "X is not defined" → the local name might be wrong; the injected locals
  are exactly: app, api, document, window, useCanvasStore, useCommandStore,
  useWorkflowStore, useMissingModelStore, useExecutionErrorStore,
  useSettingStore. Use them verbatim — no imports needed.
- "Cannot read properties of undefined" → probe with 'describe <expr>'
  which returns type + own properties + prototype methods, then write
  the real mutation. Example:
    describe useCanvasStore().canvas.graph
    describe useCanvasStore().canvas.graph._nodes[0]
- After mutation, VERIFY the effect with another read (e.g.
  node-list --json or run-js probe). If not as expected, iterate again.
- Only reply to the user once the task is fully done AND verified by
  working evidence (see rule above), OR you are genuinely stuck after
  3+ distinct attempts with different strategies. In the stuck case,
  describe exactly what was tried, paste the last error, and ask a
  concrete question.

Layout recipes (use when user asks tree/LR/TB/stack/arrange/organize):

  # Top-down leveled tree (longest-path levelling, stable within-level)
  run-js 'const g = useCanvasStore().canvas.graph;
    const N = g._nodes; const L = Array.isArray(g.links)?g.links:Object.values(g.links);
    const parents = new Map(N.map(n=>[n.id,new Set()]));
    for (const l of L) if (l) parents.get(l.target_id)?.add(l.origin_id);
    const lvl = new Map(N.map(n=>[n.id,0]));
    let changed = true, guard = N.length*2;
    while (changed && guard--) { changed = false;
      for (const n of N) { let m = -1; for (const p of parents.get(n.id)) m = Math.max(m, lvl.get(p)); if (m+1 > lvl.get(n.id)) { lvl.set(n.id, m+1); changed = true; } } }
    const byLv = new Map(); for (const n of N) (byLv.get(lvl.get(n.id)) ?? byLv.set(lvl.get(n.id),[]).get(lvl.get(n.id))).push(n);
    let y = 100; for (const k of [...byLv.keys()].sort((a,b)=>a-b)) { const row = byLv.get(k).sort((a,b)=>a.id-b.id); let x = 100; let maxH = 0; for (const n of row) { n.pos = [x, y]; x += (n.size?.[0]||240) + 40; maxH = Math.max(maxH, n.size?.[1]||80); } y += maxH + 80; }
    g.setDirtyCanvas(true,true);
    useWorkflowStore().activeWorkflow?.changeTracker?.checkState();
    return "laid out " + N.length + " nodes";'

  # Left-right variant: swap x/y, swap width/height in the spacing.

run-js recipes for area-specific intents (when no native command fits):

  # Node color / title (per-node cosmetic changes)
  run-js 'const g = useCanvasStore().canvas.graph;
    const n = g._nodes.find(n => n.id === 5);
    n.color = "#322"; n.bgcolor = "#533"; n.title = "My Sampler";
    g.setDirtyCanvas(true,true);
    useWorkflowStore().activeWorkflow?.changeTracker?.checkState();'

  # Viewport control (zoom / pan) via DragAndScale
  run-js 'const ds = useCanvasStore().canvas.ds;
    ds.scale = 1;  // reset zoom
    ds.offset = [0, 0];  // reset pan
    useCanvasStore().canvas.setDirty(true, true);'

  # Clipboard
  run-js 'await navigator.clipboard.writeText("text"); return "copied";'
  run-js 'return await navigator.clipboard.readText();'

  # Selection (select all KSampler nodes)
  run-js 'const c = useCanvasStore().canvas;
    c.deselectAllNodes();
    for (const n of c.graph._nodes) if (n.comfyClass === "KSampler") c.selectNode(n, true);
    c.setDirty(true, true); return c.selected_nodes ? Object.keys(c.selected_nodes).length : 0;'

Output style:
- Tool output (system messages) is visible to the user automatically.
- Your job on top of that is to ANSWER IN NATURAL LANGUAGE. A bare tool
  trace is not an answer — always follow up with a 1-4 sentence
  summary in the user's language (detect from their message).
- NEVER end the turn with a pre-tool message like "please wait",
  "working on it", "will do it now", "少々お待ちください". If you said
  that before the tool, you MUST follow up AFTER the tool completes
  with the concrete result.
- Pass JS to run-js UNQUOTED when used via the raw shortcut. Both forms
  are accepted (outer matching quotes are stripped), but unquoted reads
  better in terminals. Example:
    run-js return useCanvasStore().canvas.graph._nodes.length
  Example (bad):
    User: 'describe this workflow'
    Agent calls 'graph summary' → tool output shown, agent writes nothing.
  Example (good):
    User: 'describe this workflow'
    Agent calls 'graph summary' → tool output shown.
    Agent: "This is a text-to-image SD pipeline: a CheckpointLoader
            feeds a KSampler driven by two CLIP text prompts, the
            resulting latent goes through VAEDecode and SaveImage.
            Seven nodes total."

Examples:
  User: "new workflow" / "clear canvas" / "CREATE A NEW empty workflow"
        → Comfy.NewBlankWorkflow  (verify: active-workflow / graph summary)
  User: "open a workflow named X"     → Comfy.OpenWorkflow  (+ arg passthrough)
  User: "save"                        → Comfy.SaveWorkflow
  User: "save as X" / "save it as X"  → save-as X  (NOT Comfy.SaveWorkflowAs —
                                         that opens a modal and the agent
                                         cannot fill it in)
  User: "create a new workflow named X" / "new workflow called X"
                                      → new-workflow X  (one step: blank +
                                         save-as, no modal)
  User: "rename this workflow to X"   → rename-workflow X  (NOT
                                         Comfy.RenameWorkflow — modal)
  User: "clear workflow" / "clear the canvas" (destructive)
                                      → clear-workflow --force  (NOT
                                         Comfy.ClearWorkflow — modal confirm)
  User: "set the subgraph description to X"
                                      → set-subgraph-desc X  (NOT
                                         Comfy.Subgraph.SetDescription — modal)
  User: "set subgraph aliases to a,b,c"
                                      → set-subgraph-aliases a b c
  User: "add a KSampler" / "add a nano banana node"
                                      → FIRST: node-search <pattern> to find
                                         the exact registered type name.
                                         THEN: add-node <type> [x] [y]
  User: "align these nodes to the left" / "align selected top"
                                      → align-nodes left | right | center-x
                                                    | top  | bottom | center-y
  User: "space these out evenly" / "distribute horizontally"
                                      → distribute-nodes h   (or v)
  User: "show me the queue panel" / "open history"
                                      → toggle-panel queue   (or history,
                                         assets, workflows, models,
                                         node-library, errors, parameters, …)
  User: "undo" / "redo"               → Comfy.Undo / Comfy.Redo
  User: "run it" / "queue"            → Comfy.QueuePrompt
  User: "stop"                        → Comfy.Interrupt
  User: "zoom to fit"                 → Comfy.Canvas.FitView
  User: "what models are missing?"    → missing-models
  User: "what's wrong?"               → workflow-errors
  User: "layout as tree / top-down"   → layout recipe above (run-js)
  User: "make it a tight grid"        → node-list --json, apply-layout
  User: "how many KSampler nodes?"    → run-js 'return useCanvasStore().canvas.graph._nodes.filter(n=>n.comfyClass==="KSampler").length'
  User: "copy my workflow link"       → run-js 'navigator.clipboard.writeText(location.href)'
  User: "dark mode" / "ensure dark mode" / "暗色モード"
        → NEVER blindly run Comfy.ToggleTheme — it flips unconditionally.
        → 1. Read current state (idempotent check):
             run-js 'return useColorPaletteStore().completedActivePalette.light_theme'
           (useColorPaletteStore may not be in the inject list; fall back to
            run-js 'return useSettingStore().get("Comfy.ColorPalette")')
        → 2. If already in the requested mode, reply "already dark — no change".
        → 3. Otherwise run Comfy.ToggleTheme.
        → 4. VERIFY after with the same read and confirm the new state.
       Same logic applies for "ensure X" / "should be Y" phrasings of any toggle.
  User: "select all sampler nodes"    → run-js (iterate _nodes, set selected=true, canvas.setDirty)
  User: "delete the last KSampler"    → run-js (find, call graph.remove(node), checkState)
  User: "tell me seeds used today"    → history → filter → parse widget.seed values
  User: "describe this workflow" / "このワークフローを説明して"
        → graph summary (+ graph nodes / graph-links if needed for detail)
        → reply: 1-4 sentence prose summary in the user's language
          describing what the pipeline does, NOT raw tool output.

  Quality gate (recommended for expensive pipelines):
    After any SaveImage in a multi-phase chain, call
      'validate <filename> "does this match the user's ask: <summary>?"'
    If Gemini's rating is low (<=3/5) or feedback notes missing elements,
    refine the prompt and regenerate BEFORE starting 3D/video phase —
    saves 30-45 min of wasted cloud/CPU work on a bad image.

  Cloud Tripo / Tencent / Meshy / Rodin nodes ALWAYS need a Preview3D
  output_node downstream — without it, the GLB gets generated but
  doesn't render in the UI canvas. Recipe:
    1. add-node TripoImageToModelNode (or Tencent/Meshy/Rodin)
    2. add-node Preview3D
    3. connect <tripo_id>.GLB <preview3d_id>.model_file
    4. comfy queueprompt
  The Preview3D node renders the 3D mesh inline so the user can rotate
  and inspect it. WITHOUT this step, the user will say "I see no 3D
  model" even though the .glb is on disk.

  User: "make me a 3D model of X described in words" / "image-to-3D but
        first generate the image from this prompt":
        → This is a TWO-PHASE chain. Do not try to do it in one template.
          1. 'load-template default <t2i_template>' (or demo-t2i equivalent)
             with a prompt tuned for image-to-3D: "single centered object
             on white background, studio lighting, 3d reference".
          2. set-widget on the positive CLIPTextEncode to the user's subject.
          3. 'comfy queueprompt' → 'wait-queue --timeout=600'.
          4. 'latest-output-name' to grab the generated PNG filename.
          5. 'copy-to-input <name> as 3d_hunyuan3d-v2.1_input_image.png'
             (or whatever filename the 3D template's LoadImage expects).
          6. 'load-template default 3d_hunyuan3d-v2.1' (or a chosen 3D tpl).
          7. 'comfy queueprompt' → 'wait-queue --timeout=3600'.
          8. 'latest-output-name' → the resulting .glb path.
        Verify each phase's output exists before starting the next — if
        phase 1 didn't produce an image, don't queue phase 2.

  User: "make me a 3D model of X" / "generate a video" / "upscale this" /
        anything you don't have a hand-built recipe for:
        → 1) 'templates <keyword>' to find an existing template — try
             'templates 3d', 'templates video', 'templates controlnet'.
          2) If one matches, 'load-template <module> <id>' — that gives
             a WORKING pipeline with the right models referenced.
          3) Update prompts / widgets via 'set-widget' for what the user
             asked, then 'comfy queueprompt'.
          4) If queue fails, 'missing-models' shows what to install.
             Relay exact names to the user — model install is not yet
             automatable from the agent.
        DO NOT build 3D / video / audio pipelines from scratch via
        add-node — templates exist for exactly this.

For ANY intent: if no command matches, translate the intent into one
run-js call that uses the stores/app above. Do not refuse until you've
at least tried run-js.`

interface SessionOptions {
  apiKey: string
  model: string
  baseURL?: string
  reasoningEffort?: string
  systemPromptAppend?: string
  messages: ModelMessage[]
  execContext: ExecContext
  signal?: AbortSignal
  maxSteps?: number
}

export interface ToolInvocation {
  script: string
  stdout: string
  stderr?: string
  exitCode: number
}

interface SessionResult {
  text: string
  toolCalls: ToolInvocation[]
}

export async function streamSession(
  opts: SessionOptions,
  onDelta: (chunk: string) => void,
  onTool: (inv: ToolInvocation) => void
): Promise<SessionResult> {
  const openai = createOpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL
  })
  const toolCalls: ToolInvocation[] = []

  const system = opts.systemPromptAppend
    ? `${SYSTEM_PROMPT}\n\n# Additional instructions\n${opts.systemPromptAppend}`
    : SYSTEM_PROMPT

  // Reasoning-capable OpenAI models (o1/o3/gpt-5 line) accept reasoningEffort
  // via providerOptions. Non-reasoning models silently ignore it.
  const providerOptions = opts.reasoningEffort
    ? { openai: { reasoningEffort: opts.reasoningEffort } }
    : undefined

  const tools = {
    run_shell: tool({
      description:
        'Run one or more shell commands. Supports pipes (|), sequencing (&&, ||, ;), and redirection (>, >>). Returns stdout, stderr, and exit code.',
      inputSchema: z.object({
        script: z.string().describe('The shell script to execute')
      }),
      execute: async ({ script }: { script: string }) => {
        // Layer 1: refuse fragile idioms before they run. Returning a
        // non-zero exitCode + stderr is what the model sees, so it can
        // adapt without losing context.
        const vet = vetScript(script)
        if (!vet.ok) {
          const inv: ToolInvocation = {
            script,
            stdout: '',
            stderr: vet.error,
            exitCode: 2
          }
          toolCalls.push(inv)
          onTool(inv)
          return { stdout: '', stderr: vet.error, exitCode: 2 }
        }
        const res = await runScript(script, opts.execContext)
        const stdout = await collect(res.stdout)
        const inv: ToolInvocation = {
          script,
          stdout,
          stderr: res.stderr,
          exitCode: res.exitCode
        }
        toolCalls.push(inv)
        onTool(inv)
        return {
          stdout,
          stderr: res.stderr ?? '',
          exitCode: res.exitCode
        }
      }
    })
  }

  let messages: ModelMessage[] = [...opts.messages]
  let combinedText = ''
  let autoContinues = 0

  while (true) {
    if (opts.signal?.aborted) break
    const before = toolCalls.length
    const { textStream, text } = streamText({
      model: openai(opts.model),
      system,
      messages,
      abortSignal: opts.signal,
      stopWhen: stepCountIs(opts.maxSteps ?? 1000),
      providerOptions,
      tools
    })
    for await (const delta of textStream) onDelta(delta)
    const finalText = await text
    combinedText += finalText
    const toolsDuringTurn = toolCalls.length - before

    // Auto-continue heuristics — force another tool round when:
    //   (a) the model wrote a promissory phrase but stopped, OR
    //   (b) the model gave a confident final answer that rests on a
    //       tool call which produced no stdout and a non-zero exit
    //       (the silent-grep / empty-pipe failure mode).
    const lastTool = toolCalls[toolCalls.length - 1]
    const silentFail =
      lastTool !== undefined &&
      lastTool.exitCode !== 0 &&
      lastTool.stdout.trim().length === 0
    const promissory =
      finalText.length > 0 && PROMISSORY_PATTERN.test(finalText)

    // Layer 2: definitive-claim verification. Only run if the model
    // appears to have committed to an answer (not promissory, not empty).
    let claimMismatch: ClaimCheckResult | null = null
    if (
      finalText.trim().length > 0 &&
      !promissory &&
      autoContinues < MAX_AUTOCONTINUE
    ) {
      claimMismatch = await verifyClaims(finalText, async (script) => {
        const r = await runScript(script, opts.execContext)
        return { stdout: await collect(r.stdout), exitCode: r.exitCode }
      })
    }

    const stalled =
      autoContinues < MAX_AUTOCONTINUE &&
      (promissory ||
        (silentFail && finalText.length > 0) ||
        claimMismatch !== null)

    if (!stalled) break

    autoContinues++
    let nudge: string
    let reason: string
    if (claimMismatch) {
      nudge =
        '[auto-continue] Your answer was contradicted by an independent ' +
        'verification: ' +
        claimMismatch.contradiction +
        '. DO NOT REPHRASE the same claim — that does not fix anything. ' +
        'Either: (a) fix the underlying issue and re-verify, OR (b) tell the ' +
        'user clearly that the action FAILED and what blocked it. Re-run the ' +
        'verifier yourself with: ' +
        claimMismatch.verifier.derive +
        ' — and adjust your behaviour based on its actual output.'
      reason = 'claim-mismatch'
    } else if (silentFail && !promissory) {
      nudge =
        '[auto-continue] Your last tool call exited ' +
        String(lastTool?.exitCode) +
        ' with empty stdout — your final answer rests on a query that ' +
        'returned nothing. Verify your conclusion with a different ' +
        'approach (e.g. run-js with a return statement) before answering. ' +
        'Do not narrate now — run the verifying tool call.'
      reason = 'silent-fail'
    } else if (toolsDuringTurn === 0) {
      nudge =
        '[auto-continue] You promised follow-up action but stopped without ' +
        'executing it. Run the next tool call now — do not narrate, act.'
      reason = 'promissory'
    } else {
      nudge =
        '[auto-continue] Your last turn surfaced something that needs ' +
        'another step. Take that step now via run_shell — no preamble.'
      reason = 'promissory'
    }
    messages = [
      ...messages,
      { role: 'assistant', content: finalText },
      { role: 'user', content: nudge }
    ]
    onDelta(
      `\n\n[agent: auto-continuing — ${reason} detected, attempt ${autoContinues}/${MAX_AUTOCONTINUE}]\n\n`
    )
  }

  return { text: combinedText, toolCalls }
}
