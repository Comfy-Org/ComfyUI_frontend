import { describe, expect, it } from 'vitest'

import {
  fetchDeveloperProfile,
  fetchDeveloperReviews,
  fetchDownloadHistory,
  fetchPublishedTemplates,
  fetchTemplateRevenue,
  getCurrentUsername,
  saveDeveloperProfile,
  unpublishTemplate
} from '@/services/developerProfileService'

describe('developerProfileService', () => {
  it('getCurrentUsername returns @StoneCypher', () => {
    expect(getCurrentUsername()).toBe('@StoneCypher')
  })

  it('fetchDeveloperProfile returns a valid profile shape', async () => {
    const profile = await fetchDeveloperProfile('@StoneCypher')

    expect(profile.username).toBe('@StoneCypher')
    expect(typeof profile.displayName).toBe('string')
    expect(typeof profile.isVerified).toBe('boolean')
    expect(typeof profile.monetizationEnabled).toBe('boolean')
    expect(profile.joinedAt).toBeInstanceOf(Date)
    expect(typeof profile.totalDownloads).toBe('number')
    expect(typeof profile.totalFavorites).toBe('number')
    expect(profile.averageRating).toBeGreaterThanOrEqual(0)
    expect(profile.averageRating).toBeLessThanOrEqual(5)
    expect(typeof profile.templateCount).toBe('number')
  })

  it('fetchDeveloperReviews returns reviews with valid ratings', async () => {
    const reviews = await fetchDeveloperReviews('@StoneCypher')

    expect(reviews.length).toBeGreaterThan(0)
    for (const review of reviews) {
      expect(review.rating).toBeGreaterThanOrEqual(1)
      expect(review.rating).toBeLessThanOrEqual(5)
      expect(review.rating % 0.5).toBe(0)
      expect(typeof review.text).toBe('string')
      expect(typeof review.authorName).toBe('string')
      expect(review.createdAt).toBeInstanceOf(Date)
    }
  })

  it('fetchPublishedTemplates returns templates with stats', async () => {
    const templates = await fetchPublishedTemplates('@StoneCypher')

    expect(templates.length).toBeGreaterThan(0)
    for (const tpl of templates) {
      expect(typeof tpl.id).toBe('string')
      expect(typeof tpl.title).toBe('string')
      expect(typeof tpl.stats.downloads).toBe('number')
      expect(typeof tpl.stats.favorites).toBe('number')
      expect(typeof tpl.stats.rating).toBe('number')
    }
  })

  it('fetchTemplateRevenue returns revenue per template', async () => {
    const revenue = await fetchTemplateRevenue('@StoneCypher')

    expect(revenue.length).toBeGreaterThan(0)
    for (const entry of revenue) {
      expect(typeof entry.templateId).toBe('string')
      expect(typeof entry.totalRevenue).toBe('number')
      expect(typeof entry.monthlyRevenue).toBe('number')
      expect(typeof entry.currency).toBe('string')
    }
  })

  it('unpublishTemplate resolves without error', async () => {
    await expect(unpublishTemplate('tpl-1')).resolves.toBeUndefined()
  })

  it('saveDeveloperProfile echoes back a complete profile', async () => {
    const result = await saveDeveloperProfile({ bio: 'Updated bio' })

    expect(result.bio).toBe('Updated bio')
    expect(typeof result.username).toBe('string')
    expect(typeof result.displayName).toBe('string')
    expect(typeof result.isVerified).toBe('boolean')
  })

  it('fetchDeveloperProfile returns a different profile for @PixelWizard', async () => {
    const profile = await fetchDeveloperProfile('@PixelWizard')

    expect(profile.username).toBe('@PixelWizard')
    expect(profile.displayName).toBe('Pixel Wizard')
    expect(profile.isVerified).toBe(false)
  })

  it('fetchDeveloperProfile returns a fallback for unknown usernames', async () => {
    const profile = await fetchDeveloperProfile('@Unknown')

    expect(profile.username).toBe('@Unknown')
    expect(profile.displayName).toBe('Unknown')
    expect(profile.totalDownloads).toBe(0)
  })

  it('fetchPublishedTemplates returns different templates per developer', async () => {
    const stoneTemplates = await fetchPublishedTemplates('@StoneCypher')
    const pixelTemplates = await fetchPublishedTemplates('@PixelWizard')
    const unknownTemplates = await fetchPublishedTemplates('@Unknown')

    expect(stoneTemplates).toHaveLength(3)
    expect(pixelTemplates).toHaveLength(1)
    expect(pixelTemplates[0].title).toBe('Dreamy Landscapes img2img')
    expect(unknownTemplates).toHaveLength(0)
  })

  it('fetchDeveloperReviews returns empty for unknown developers', async () => {
    const reviews = await fetchDeveloperReviews('@Unknown')
    expect(reviews).toHaveLength(0)
  })

  it('fetchTemplateRevenue returns empty for non-monetized developers', async () => {
    const revenue = await fetchTemplateRevenue('@PixelWizard')
    expect(revenue).toHaveLength(0)
  })

  it('fetchDownloadHistory returns 730 days of entries', async () => {
    const history = await fetchDownloadHistory('@StoneCypher')

    expect(history).toHaveLength(730)
    for (const entry of history) {
      expect(entry.date).toBeInstanceOf(Date)
      expect(entry.downloads).toBeGreaterThanOrEqual(0)
    }
  })

  it('fetchDownloadHistory returns entries in chronological order', async () => {
    const history = await fetchDownloadHistory('@StoneCypher')

    for (let i = 1; i < history.length; i++) {
      expect(history[i].date.getTime()).toBeGreaterThan(
        history[i - 1].date.getTime()
      )
    }
  })

  it('fetchDownloadHistory produces different data per username', async () => {
    const stoneHistory = await fetchDownloadHistory('@StoneCypher')
    const pixelHistory = await fetchDownloadHistory('@PixelWizard')

    const stoneTotal = stoneHistory.reduce((s, e) => s + e.downloads, 0)
    const pixelTotal = pixelHistory.reduce((s, e) => s + e.downloads, 0)

    expect(stoneTotal).not.toBe(pixelTotal)
  })
})
