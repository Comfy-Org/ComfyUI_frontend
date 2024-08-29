import { buildTree } from '@/utils/treeUtil'

describe('buildTree', () => {
  it('should handle empty folder items correctly', () => {
    const items = [
      { path: 'a/b/c/' },
      { path: 'a/b/d.txt' },
      { path: 'a/e/' },
      { path: 'f.txt' }
    ]

    const tree = buildTree(items, (item) => item.path.split('/'))

    expect(tree).toEqual({
      key: 'root',
      label: 'root',
      children: [
        {
          key: 'root/a',
          label: 'a',
          leaf: false,
          children: [
            {
              key: 'root/a/b',
              label: 'b',
              leaf: false,
              children: [
                {
                  key: 'root/a/b/c',
                  label: 'c',
                  leaf: false,
                  children: [],
                  data: { path: 'a/b/c/' }
                },
                {
                  key: 'root/a/b/d.txt',
                  label: 'd.txt',
                  leaf: true,
                  children: [],
                  data: { path: 'a/b/d.txt' }
                }
              ]
            },
            {
              key: 'root/a/e',
              label: 'e',
              leaf: false,
              children: [],
              data: { path: 'a/e/' }
            }
          ]
        },
        {
          key: 'root/f.txt',
          label: 'f.txt',
          leaf: true,
          children: [],
          data: { path: 'f.txt' }
        }
      ]
    })
  })
})
