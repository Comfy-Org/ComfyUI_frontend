#!/usr/bin/env node

import { intro, outro } from '@clack/prompts'
import pc from 'picocolors'

const args = process.argv.slice(2)
const command = args[0]

intro(pc.bgCyan(pc.black(' 🎭 ComfyUI Test Recorder ')))

try {
  switch (command) {
    case 'record': {
      const { parseFlags } = await import('./cli/flags')
      const { flags } = parseFlags(args.slice(1), [
        'distribution',
        'backend',
        'workflow',
        'tags',
        'feature-flags',
        'use-case',
        'description',
        'name',
        'pr'
      ])
      const { resolveRecordPrefill } = await import('./commands/recordPrefill')
      const { runRecord } = await import('./commands/record')
      await runRecord(resolveRecordPrefill(flags))
      break
    }
    case 'add-workflow': {
      const { parseFlags } = await import('./cli/flags')
      const { positional, flags } = parseFlags(args.slice(1), ['name'])
      const filePath = positional[0]
      if (!filePath) {
        console.log(
          pc.red('  Usage: comfy-test add-workflow <file> [--name <n>]')
        )
        process.exit(1)
      }
      const { runAddWorkflow } = await import('./commands/addWorkflow')
      runAddWorkflow(filePath, flags.name)
      break
    }
    case 'transform': {
      const { parseFlags, parseTags } = await import('./cli/flags')
      const { positional, flags } = parseFlags(args.slice(1), [
        'name',
        'tags',
        'workflow',
        'output',
        'feature-flags'
      ])
      const filePath = positional[0]
      if (!filePath) {
        console.log(
          pc.red(
            '  Usage: comfy-test transform <file> [--name <n>] [--tags <a,b>] [--workflow <w>] [--output <f>] [--feature-flags <specs>]'
          )
        )
        process.exit(1)
      }
      const { parseFeatureFlagSpecs } = await import('./featureFlags')
      const { runTransform } = await import('./commands/transform')
      await runTransform(filePath, {
        testName: flags.name,
        tags: parseTags(flags.tags),
        workflow: flags.workflow,
        output: flags.output,
        featureFlags: flags['feature-flags']
          ? parseFeatureFlagSpecs(flags['feature-flags'].split(','))
          : undefined
      })
      break
    }
    case 'pr': {
      const filePath = args[1]
      if (!filePath) {
        console.log(pc.red('  Usage: comfy-test pr <file.spec.ts>'))
        process.exit(1)
      }
      const { runPr } = await import('./commands/pr')
      await runPr(filePath, args[2])
      break
    }
    case 'plan': {
      const { parseFlags, parseTags } = await import('./cli/flags')
      const { flags } = parseFlags(args.slice(1), [
        'description',
        'tags',
        'workflow',
        'name',
        'feature-flags'
      ])
      if (!flags.description) {
        console.log(
          pc.red(
            '  Usage: comfy-test plan --description "<what to test>" [--tags <a,b>] [--workflow <w>] [--name <n>] [--feature-flags <specs>]'
          )
        )
        process.exit(1)
      }
      const { parseFeatureFlagSpecs } = await import('./featureFlags')
      const { runPlan } = await import('./commands/plan')
      await runPlan({
        description: flags.description,
        tags: parseTags(flags.tags),
        workflow: flags.workflow,
        name: flags.name,
        featureFlags: flags['feature-flags']
          ? parseFeatureFlagSpecs(flags['feature-flags'].split(','))
          : undefined
      })
      break
    }
    case 'check': {
      const { parseFlags } = await import('./cli/flags')
      const { flags } = parseFlags(args.slice(1), ['backend', 'distribution'])
      const {
        customDistribution,
        distributionIds,
        normalizeBackendUrl,
        resolveDistribution
      } = await import('./devserver/distributions')
      const backendInput = flags.backend ?? process.env.COMFY_TEST_BACKEND
      const distributionId =
        flags.distribution ?? process.env.COMFY_TEST_DISTRIBUTION
      if (
        backendInput !== undefined &&
        flags.distribution !== undefined &&
        flags.distribution !== 'custom'
      ) {
        console.log(
          pc.red(
            '  --backend cannot be combined with --distribution other than custom.'
          )
        )
        process.exitCode = 1
        break
      }
      const normalizedBackend =
        backendInput === undefined
          ? undefined
          : normalizeBackendUrl(backendInput)
      if (normalizedBackend && !normalizedBackend.ok) {
        console.log(
          pc.red(`  Invalid backend URL: ${normalizedBackend.reason}`)
        )
        process.exitCode = 1
        break
      }
      const distribution = normalizedBackend?.ok
        ? customDistribution(normalizedBackend.url)
        : resolveDistribution(distributionId)
      if (!distribution) {
        console.log(
          pc.red(
            `  Invalid distribution "${distributionId}". Valid distributions: ${distributionIds().join(', ')}`
          )
        )
        process.exitCode = 1
        break
      }
      const { runChecks } = await import('./commands/check')
      const { allPassed } = await runChecks(distribution)
      if (!allPassed) {
        console.log()
        console.log(
          pc.red(
            '  Some required checks failed. Fix the issues above and try again.'
          )
        )
        process.exitCode = 1
      }
      break
    }
    case 'agent-replay': {
      const { parseFlags } = await import('./cli/flags')
      const { flags } = parseFlags(args.slice(1), ['case', 'url'])
      const { runAgentReplay } = await import('./commands/agentReplay')
      process.exitCode = runAgentReplay({
        caseId: flags.case,
        url: flags.url,
        headed: flags.headed !== undefined,
        video: flags.video !== undefined
      })
      break
    }
    case 'list': {
      const { parseFlags } = await import('./cli/flags')
      const { flags } = parseFlags(args.slice(1), ['filter'])
      const { runList } = await import('./commands/list')
      await runList(flags.filter)
      break
    }
    case 'tags': {
      const { runTags } = await import('./commands/tags')
      runTags()
      break
    }
    case 'guide': {
      const { runGuide } = await import('./commands/guide')
      runGuide()
      break
    }
    default: {
      // Help is a successful request; a typo is not.
      const askedForHelp =
        command === undefined || command === '--help' || command === 'help'
      if (!askedForHelp) {
        console.log(pc.red(`  Unknown command: ${command}`))
        process.exitCode = 1
      }
      console.log(`
Usage: comfy-test <command>

Commands:
  record [--distribution <id>] [--backend <url>] [--workflow <name>]
         [--tags <a,b>] [--feature-flags <specs>] [--use-case <id>]
         [--description <text>] [--name <slug>] [--pr <number>]
              Record a browser test; supplied answers skip setup prompts
  add-workflow <file> [--name <n>]
              Add and validate a workflow asset from disk
  plan        Print a test plan for an agent to hand to playwright-test-generator
  transform   Transform raw codegen output to conventions
  pr          Open a pull request for a generated test
  check [--distribution cloud|cloud-staging|cloud-prod|local] [--backend <url>]
              Check environment prerequisites (defaults to cloud)
  agent-replay [--case <id>] [--url <dev server>] [--headed] [--video]
              Replay the recorded agent conversations as tests against a
              running dev server (see .claude/skills/agent-integration-replay)
  list [--filter <keyword>]
              List available test workflows, optionally filtered by path
  tags        List test tags with their meanings
  guide       Print instructions for an agent who is helping a human record

Options:
  --help      Show help

If you are an agent helping a HUMAN record a test: run 'comfy-test guide'
first and follow it — it tells you what to say and what never to say.

If you are an agent (not a human at a terminal): 'record' needs a real
TTY and will refuse to run. Use this instead:

  comfy-test plan --description "<what to test>" [--tags a,b] [--workflow w] [--feature-flags name:value,...]
  → hand the printed block to the playwright-test-generator agent
  → comfy-test pr <the file it wrote>

Transform flags:
  --feature-flags <specs>
              Seed comma-separated feature flags in the generated test

'add-workflow', 'transform', 'pr', 'check', 'plan', 'list', 'tags', and 'agent-replay' work non-interactively.
`)
      break
    }
  }
} catch (error) {
  console.log(pc.red(error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
}

outro(pc.dim('https://github.com/Comfy-Org/ComfyUI_frontend'))
