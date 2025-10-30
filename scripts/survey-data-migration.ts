#!/usr/bin/env node

/**
 * Survey Data Migration Script
 *
 * One-time utility to normalize existing Mixpanel user properties
 * for industry and use case fields. This addresses the proliferation
 * of one-off categories that make analytics difficult.
 *
 * Usage: pnpm ts-node scripts/survey-data-migration.ts
 *
 * IMPORTANT: This script requires Mixpanel Data Management API access
 * and should be run with appropriate credentials in production.
 */

/* eslint-disable no-console */

import {
  normalizeIndustry,
  normalizeUseCase
} from '../src/platform/telemetry/utils/surveyNormalization'

interface MixpanelUser {
  $distinct_id: string
  $properties: {
    industry?: string
    useCase?: string
    [key: string]: any
  }
}

interface MigrationStats {
  totalUsers: number
  industryNormalized: number
  useCaseNormalized: number
  uncategorizedIndustries: Set<string>
  uncategorizedUseCases: Set<string>
}

/**
 * Simulate the data migration process
 * In production, this would integrate with Mixpanel Data Management API
 */
function simulateMigration(users: MixpanelUser[]): MigrationStats {
  const stats: MigrationStats = {
    totalUsers: users.length,
    industryNormalized: 0,
    useCaseNormalized: 0,
    uncategorizedIndustries: new Set<string>(),
    uncategorizedUseCases: new Set<string>()
  }

  users.forEach((user) => {
    let needsUpdate = false
    const updates: Record<string, any> = {}

    // Process industry normalization
    if (user.$properties.industry) {
      const normalized = normalizeIndustry(user.$properties.industry)

      if (normalized !== user.$properties.industry) {
        updates.industry_normalized = normalized
        updates.industry_raw = user.$properties.industry
        stats.industryNormalized++
        needsUpdate = true

        if (normalized.startsWith('Uncategorized:')) {
          stats.uncategorizedIndustries.add(user.$properties.industry)
        }
      }
    }

    // Process use case normalization
    if (user.$properties.useCase) {
      const normalized = normalizeUseCase(user.$properties.useCase)

      if (normalized !== user.$properties.useCase) {
        updates.useCase_normalized = normalized
        updates.useCase_raw = user.$properties.useCase
        stats.useCaseNormalized++
        needsUpdate = true

        if (normalized.startsWith('Uncategorized:')) {
          stats.uncategorizedUseCases.add(user.$properties.useCase)
        }
      }
    }

    // In production, this would make API calls to update user properties
    if (needsUpdate) {
      console.log(`Would update user ${user.$distinct_id}:`, updates)
    }
  })

  return stats
}

/**
 * Generate sample data for testing normalization rules
 */
function generateSampleData(): MixpanelUser[] {
  return [
    {
      $distinct_id: 'user1',
      $properties: {
        industry: 'Film and television production',
        useCase: 'Creating concept art for movies'
      }
    },
    {
      $distinct_id: 'user2',
      $properties: {
        industry: 'Marketing & Social Media',
        useCase: 'YouTube thumbnail generation'
      }
    },
    {
      $distinct_id: 'user3',
      $properties: {
        industry: 'Software Development',
        useCase: 'Product mockup creation'
      }
    },
    {
      $distinct_id: 'user4',
      $properties: {
        industry: 'Indie Game Studio',
        useCase: 'Game asset generation'
      }
    },
    {
      $distinct_id: 'user5',
      $properties: {
        industry: 'Architecture firm',
        useCase: 'Building visualization'
      }
    },
    {
      $distinct_id: 'user6',
      $properties: {
        industry: 'Custom Jewelry Design',
        useCase: 'Product photography'
      }
    },
    {
      $distinct_id: 'user7',
      $properties: {
        industry: 'Medical Research',
        useCase: 'Scientific visualization'
      }
    },
    {
      $distinct_id: 'user8',
      $properties: {
        industry: 'Unknown Creative Field',
        useCase: 'Personal art projects'
      }
    }
  ]
}

/**
 * Production implementation would use Mixpanel Data Management API
 * Example API structure (not actual implementation):
 */
async function productionMigration() {
  console.log('🔧 Production Migration Process:')
  console.log('1. Export user profiles via Mixpanel Data Management API')
  console.log('2. Apply normalization to industry and useCase fields')
  console.log(
    '3. Create new properties: industry_normalized, useCase_normalized'
  )
  console.log('4. Preserve original values as: industry_raw, useCase_raw')
  console.log('5. Batch update user profiles')
  console.log('6. Generate uncategorized response report for review')

  /*
  Example API calls:
  
  // 1. Export users
  const users = await mixpanel.people.query({
    where: 'properties["industry"] != null or properties["useCase"] != null'
  })
  
  // 2. Process and update
  for (const user of users) {
    const normalizedData = normalizeSurveyResponses(user.properties)
    await mixpanel.people.set(user.distinct_id, normalizedData)
  }
  */
}

/**
 * Main migration runner
 */
function main() {
  console.log('📊 Survey Data Migration Utility')
  console.log('================================\n')

  // Run simulation with sample data
  console.log('🧪 Running simulation with sample data...\n')
  const sampleUsers = generateSampleData()
  const stats = simulateMigration(sampleUsers)

  // Display results
  console.log('📈 Migration Results:')
  console.log(`Total users processed: ${stats.totalUsers}`)
  console.log(`Industry fields normalized: ${stats.industryNormalized}`)
  console.log(`Use case fields normalized: ${stats.useCaseNormalized}`)

  if (stats.uncategorizedIndustries.size > 0) {
    console.log('\n❓ Uncategorized Industries (need review):')
    Array.from(stats.uncategorizedIndustries).forEach((industry) => {
      console.log(`  • ${industry}`)
    })
  }

  if (stats.uncategorizedUseCases.size > 0) {
    console.log('\n❓ Uncategorized Use Cases (need review):')
    Array.from(stats.uncategorizedUseCases).forEach((useCase) => {
      console.log(`  • ${useCase}`)
    })
  }

  console.log('\n' + '='.repeat(50))
  void productionMigration()
}

// Run if called directly
if (require.main === module) {
  main()
}

export { simulateMigration, generateSampleData, MigrationStats }
