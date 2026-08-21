#!/usr/bin/env node

import { intro, outro } from '@clack/prompts'
import pc from 'picocolors'

const args = process.argv.slice(2)
const command = args[0]

intro(pc.bgCyan(pc.black(' 🎭 ComfyUI Test Recorder ')))

try {
  switch (command) {
    case 'record': {
      const { runRecord } = await import('./commands/record')
      await runRecord()
      break
    }
    case 'transform': {
      const { parseFlags } = await import('./cli/flags')
      const { positional, flags } = parseFlags(args.slice(1))
      const filePath = positional[0]
      if (!filePath) {
        console.log(
          pc.red(
            '  Usage: comfy-test transform <file> [--name <n>] [--tags <a,b>] [--workflow <w>] [--output <f>]'
          )
        )
        process.exit(1)
      }
      const tags = flags.tags?.split(',').filter(Boolean)
      const { runTransform } = await import('./commands/transform')
      await runTransform(filePath, {
        testName: flags.name,
        tags: tags && tags.length > 0 ? tags : undefined,
        workflow: flags.workflow,
        output: flags.output
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
    case 'check': {
      const { runChecks } = await import('./commands/check')
      const { allPassed } = await runChecks()
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
    case 'list': {
      const { runList } = await import('./commands/list')
      await runList()
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
  record      Record a new browser test interactively
  transform   Transform raw codegen output to conventions
  pr          Open a pull request for a generated test
  check       Check environment prerequisites
  list        List available test workflows

Options:
  --help      Show help
`)
      break
    }
  }
} catch (error) {
  console.log(pc.red(error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
}

outro(pc.dim('https://github.com/Comfy-Org/ComfyUI_frontend'))
