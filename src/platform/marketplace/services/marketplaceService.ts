import type {
  AuthorStats,
  AuthorTemplatesResponse,
  CategoriesResponse,
  CreateTemplateRequest,
  CreateTemplateResponse,
  MarketplaceTemplate,
  MediaUploadResponse,
  PublishTemplateResponse,
  SubmitTemplateResponse,
  TagSuggestResponse,
  UnpublishTemplateResponse,
  UpdateTemplateRequest
} from '@/platform/marketplace/apiTypes'
import { st } from '@/i18n'
import { api } from '@/scripts/api'

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    if (res.status === 401 || res.status === 404) {
      throw new Error(
        st(
          'marketplace.errorUnavailable',
          'Marketplace is unavailable. Start the mock server (pnpm mock:marketplace) and run the app with pnpm dev:marketplace to use this feature.'
        )
      )
    }
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ??
        `Request failed with status ${res.status}`
    )
  }
}

function createMarketplaceService() {
  async function createTemplate(
    req: CreateTemplateRequest
  ): Promise<CreateTemplateResponse> {
    const res = await api.fetchApi('/marketplace/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    })
    await assertOk(res)
    return res.json()
  }

  async function updateTemplate(
    id: string,
    updates: UpdateTemplateRequest
  ): Promise<MarketplaceTemplate> {
    const res = await api.fetchApi(`/marketplace/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    await assertOk(res)
    return res.json()
  }

  async function submitTemplate(id: string): Promise<SubmitTemplateResponse> {
    const res = await api.fetchApi(`/marketplace/templates/${id}/submit`, {
      method: 'POST'
    })
    await assertOk(res)
    return res.json()
  }

  async function publishTemplate(id: string): Promise<PublishTemplateResponse> {
    const res = await api.fetchApi(`/marketplace/templates/${id}/publish`, {
      method: 'POST'
    })
    await assertOk(res)
    return res.json()
  }

  async function unpublishTemplate(
    id: string
  ): Promise<UnpublishTemplateResponse> {
    const res = await api.fetchApi(`/marketplace/templates/${id}/unpublish`, {
      method: 'POST'
    })
    await assertOk(res)
    return res.json()
  }

  async function uploadTemplateMedia(
    id: string,
    file: File
  ): Promise<MediaUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const res = await api.fetchApi(`/marketplace/templates/${id}/media`, {
      method: 'POST',
      body: formData
    })
    await assertOk(res)
    return res.json()
  }

  async function getAuthorTemplates(): Promise<AuthorTemplatesResponse> {
    const res = await api.fetchApi('/marketplace/author/templates', {
      method: 'GET'
    })
    await assertOk(res)
    return res.json()
  }

  async function getAuthorStats(
    period: 'day' | 'week' | 'month'
  ): Promise<AuthorStats> {
    const res = await api.fetchApi(
      `/marketplace/author/stats?period=${period}`,
      { method: 'GET' }
    )
    await assertOk(res)
    return res.json()
  }

  async function getCategories(): Promise<CategoriesResponse> {
    const res = await api.fetchApi('/marketplace/categories', {
      method: 'GET'
    })
    await assertOk(res)
    return res.json()
  }

  async function suggestTags(
    query: string,
    nodeTypes?: string[]
  ): Promise<TagSuggestResponse> {
    const params = new URLSearchParams({ query })
    if (nodeTypes?.length) {
      params.set('nodeTypes', nodeTypes.join(','))
    }

    const res = await api.fetchApi(
      `/marketplace/tags/suggest?${params.toString()}`,
      { method: 'GET' }
    )
    await assertOk(res)
    return res.json()
  }

  return {
    createTemplate,
    updateTemplate,
    submitTemplate,
    publishTemplate,
    unpublishTemplate,
    uploadTemplateMedia,
    getAuthorTemplates,
    getAuthorStats,
    getCategories,
    suggestTags
  }
}

export const marketplaceService = createMarketplaceService()
