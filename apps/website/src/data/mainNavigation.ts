export type NavColumnItem = {
  label: string
  href: string
  badge?: string
  external?: boolean
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
  { label: 'Pricing', href: '/pricing' },
  {
    label: 'Community',
    featured: {
      imageSrc:
        'https://media.comfy.org/website/customers/moment-factory/hero.webp',
      imageAlt: 'Latest release demo',
      title: 'LATEST RELEASE DEMO',
      cta: {
        label: 'Watch Now',
        ariaLabel: 'Watch the latest release demo',
        href: '#'
      }
    },
    columns: [
      {
        header: 'Programs',
        items: [
          { label: 'Comfy Hub', href: '#' },
          { label: 'Gallery', href: '#' },
          { label: 'Affiliate Program', href: '#', badge: 'new' },
          { label: 'Education Program', href: '#', badge: 'new' }
        ]
      },
      {
        header: 'Connect',
        items: [
          { label: 'Discord', href: '#', external: true },
          { label: 'Reddit', href: '#', external: true },
          { label: 'Youtube', href: '#', external: true },
          { label: 'X', href: '#', external: true },
          { label: 'Instagram', href: '#', external: true }
        ]
      },
      {
        header: 'Solutions',
        items: [
          { label: 'VFX', href: '#', badge: 'new' },
          { label: 'Advertising', href: '#', badge: 'new' },
          { label: 'Learning', href: '#', badge: 'new' }
        ]
      }
    ]
  },
  {
    label: 'Company',
    featured: {
      imageSrc:
        'https://media.comfy.org/website/customers/moment-factory/hero.webp',
      imageAlt: 'Meredith Binnet, Creative Director at Black Math',
      title: 'CUSTOMER STORY: BLACK MATH',
      cta: {
        label: 'Watch Now',
        ariaLabel: 'Watch the Black Math customer story',
        href: '#'
      }
    },
    columns: [
      {
        header: 'Company',
        items: [
          { label: 'About us', href: '#' },
          { label: 'Careers', href: '#' }
        ]
      },
      {
        header: 'More',
        items: [
          { label: 'Customer Stories', href: '#' },
          { label: 'Brand', href: '#' },
          { label: 'Contact', href: '#' },
          { label: 'Drops', href: '#', badge: 'new' },
          { label: 'News', href: '#', badge: 'new' }
        ]
      }
    ]
  }
]
