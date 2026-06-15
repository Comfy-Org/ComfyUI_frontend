export type NavColumnItem = {
  label: string
  href: string
  badge?: string
}

export type NavColumn = {
  header: string
  items: NavColumnItem[]
}

export type NavFeatured = {
  imageSrc: string
  imageAlt?: string
  title: string
  cta: {
    label: string
    ariaLabel?: string
    href: string
  }
}

export type NavItem =
  | {
      label: string
      columns: NavColumn[]
      featured?: NavFeatured
      href?: never
    }
  | { label: string; href: string; columns?: never; featured?: never }

export const mainNavigation: NavItem[] = [
  {
    label: 'Products',
    featured: {
      imageSrc:
        'https://media.comfy.org/website/customers/moment-factory/hero.webp',
      imageAlt: 'Moment Factory hero image',
      title: 'NEW RELEASE: SEEDANCE 2.0',
      cta: {
        label: 'Try Workflow',
        ariaLabel: 'Try the Seedance 2.0 new release Workflow',
        href: '#'
      }
    },
    columns: [
      {
        header: 'Products',
        items: [
          { label: 'Comfy Desktop', href: '/download' },
          { label: 'Comfy Cloud', href: '/cloud' },
          { label: 'Comfy API', href: '/api', badge: 'new' },
          { label: 'Comfy Enterprise', href: '/cloud/enterprise' }
        ]
      },
      {
        header: 'Features',
        items: [
          { label: 'MCP Server', href: '#', badge: 'new' },
          { label: 'App Mode', href: '#' },
          { label: 'Agent Skills', href: '#' },
          { label: 'Docs', href: '#' }
        ]
      }
    ]
  },
  { label: 'Pricing', href: '/pricing' }
]
