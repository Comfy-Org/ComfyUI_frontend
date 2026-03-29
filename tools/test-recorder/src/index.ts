#!/usr/bin/env node

import { intro, outro } from '@clack/prompts'
import pc from 'picocolors'

const args = process.argv.slice(2)
const command = args[0]

intro(pc.bgCyan(pc.black(' 🎭 ComfyUI Test Recorder ')))

switch (command) {
  case 'record': {
    const { runRecord } = await import('./commands/record')
    await runRecord()
    break
  }
  case 'transform': {
    const filePath = args[1]
    if (!filePath) {
      console.log(pc.red('  Usage: comfy-test transform <file>'))
      process.exit(1)
    }
    const { runTransform } = await import('./commands/transform')
    await runTransform(filePath, {
      testName: args[2],
      tags: args.slice(3)
    })
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
  default:
    console.log(`
Usage: comfy-test <command>

Commands:
  record      Record a new browser test interactively
  transform   Transform raw codegen output to conventions
  check       Check environment prerequisites
  list        List available test workflows

Options:
  --help      Show help
`)
    break
}

outro(pc.dim('https://github.com/Comfy-Org/ComfyUI_frontend'))
