import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CatalogAdminShell from './CatalogAdminShell.vue'

describe('Mar catalog console layout', () => {
  it('anchors the desktop sidebar and LIVE control outside the scrolling action area', () => {
    render(CatalogAdminShell, {
      props: { current: 'draft', liveRevision: 12 }
    })
    expect(screen.getByRole('complementary')).toHaveClass(
      'lg:fixed',
      'lg:inset-y-0',
      'lg:left-0',
      'lg:w-60'
    )
    expect(screen.getByRole('region', { name: 'Catalog actions' })).toHaveClass(
      'lg:col-start-2'
    )
    expect(
      screen.getByRole('group', { name: 'Live site controls' })
    ).toHaveClass('shrink-0')
    expect(
      screen.getByRole('navigation', { name: 'Catalog administration' })
    ).toHaveClass('lg:min-h-0', 'lg:overflow-y-auto')
  })
  it('requests a verified exit-to-LIVE action rather than navigating with a Preview cookie still active', async () => {
    const result = render(CatalogAdminShell, {
      props: { current: 'draft', liveRevision: 12 }
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Open live site' })
    )
    expect(result.emitted().openLive).toEqual([[]])
    expect(
      screen.queryByRole('link', { name: 'Open live site' })
    ).not.toBeInTheDocument()
  })
  it('renders sidebar, active navigation, revision and action-area slot', () => {
    render(CatalogAdminShell, {
      props: {
        current: 'content',
        liveRevision: 12,
        draftCount: 3,
        contentCount: 45
      },
      slots: { default: '<h1>Edit content</h1>' }
    })
    expect(
      screen.getByRole('navigation', { name: 'Catalog administration' })
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'All content 45' })
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Drafts 3' })).not.toHaveAttribute(
      'aria-current'
    )
    expect(screen.getByRole('heading', { name: 'Edit content' })).toBeVisible()
    expect(screen.getByText('LIVE · Revision 12')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Tester invitations' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Publish/ })
    ).not.toBeInTheDocument()
  })
  it('only shows an invitation tool when a safe admin path was provided by the verified caller', () => {
    render(CatalogAdminShell, {
      props: {
        current: 'testers',
        liveRevision: 12,
        testersHref: '/admin/testers'
      }
    })
    expect(
      screen.getByRole('link', { name: 'Tester invitations' })
    ).toHaveAttribute('aria-current', 'page')
  })
  it('refuses unsafe navigation and treats supplied author strings as text', () => {
    render(CatalogAdminShell, {
      props: {
        current: 'content',
        liveRevision: 12,
        testersHref: '//evil.test',
        publishedBy: '<img src=x onerror=alert(1)>'
      }
    })
    expect(
      screen.queryByRole('link', { name: 'Tester invitations' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Published by <img src=x onerror=alert(1)>')
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /x/ })).not.toBeInTheDocument()
  })
  it('renders localized console labels', () => {
    render(CatalogAdminShell, {
      props: { current: 'draft', liveRevision: 12, locale: 'zh-CN' }
    })
    expect(screen.getByRole('navigation', { name: '目录管理' })).toBeVisible()
    expect(screen.getByRole('link', { name: '草稿' })).toHaveAttribute(
      'href',
      '/admin/'
    )
  })
})
