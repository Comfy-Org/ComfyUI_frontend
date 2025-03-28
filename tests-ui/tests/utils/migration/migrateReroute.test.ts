import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { WorkflowJSON04 } from '@/schemas/comfyWorkflowSchema'
import { migrateLegacyRerouteNodes } from '@/utils/migration/migrateReroute'

describe('migrateReroute', () => {
  describe('migrateReroute snapshots', () => {
    // Helper function to load workflow JSON files
    const loadWorkflow = (filePath: string): WorkflowJSON04 => {
      const fullPath = path.resolve(__dirname, filePath)
      const fileContent = fs.readFileSync(fullPath, 'utf-8')
      return JSON.parse(fileContent) as WorkflowJSON04
    }

    it.each([
      'branching.json',
      'single_connected.json',
      'floating.json',
      'floating_branch.json'
    ])('should correctly migrate %s', (fileName) => {
      // Load the legacy workflow
      const legacyWorkflow = loadWorkflow(
        `workflows/reroute/legacy/${fileName}`
      )

      // Migrate the workflow
      const migratedWorkflow = migrateLegacyRerouteNodes(legacyWorkflow)

      // Compare with snapshot
      expect(JSON.stringify(migratedWorkflow, null, 2)).toMatchFileSnapshot(
        `workflows/reroute/native/${fileName}`
      )
    })
  })
})
