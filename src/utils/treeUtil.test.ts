import { describe, expect, it } from 'vitest'

import type { TreeNode } from '@/types/treeExplorerTypes'
import {
  buildTree,
  combineTrees,
  findNodeByKey,
  flattenTree,
  sortedTree,
  unwrapTreeRoot
} from '@/utils/treeUtil'

const createNode = (label: string, leaf = false): TreeNode => ({
  key: label,
  label,
  leaf,
  children: []
})

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

describe('unwrapTreeRoot', () => {
  it('promotes the single non-leaf folder child', () => {
    const tree: TreeNode = {
      key: 'root',
      label: 'root',
      children: [
        {
          key: 'root/a',
          label: 'a',
          leaf: false,
          children: [createNode('child', true)]
        }
      ]
    }

    expect(unwrapTreeRoot(tree).children?.map((node) => node.key)).toEqual([
      'child'
    ])
  })

  it('keeps roots with leaf, empty, or multiple children intact', () => {
    const leafRoot: TreeNode = {
      key: 'root',
      label: 'root',
      children: [createNode('leaf', true)]
    }
    const emptyFolderRoot: TreeNode = {
      key: 'root',
      label: 'root',
      children: [createNode('folder')]
    }
    const multiRoot: TreeNode = {
      key: 'root',
      label: 'root',
      children: [createNode('a'), createNode('b')]
    }
    const childWithoutChildren: TreeNode = {
      key: 'root',
      label: 'root',
      children: [
        {
          key: 'root/a',
          label: 'a',
          leaf: false
        }
      ]
    }

    expect(unwrapTreeRoot(leafRoot)).toBe(leafRoot)
    expect(unwrapTreeRoot(emptyFolderRoot)).toBe(emptyFolderRoot)
    expect(unwrapTreeRoot(multiRoot)).toBe(multiRoot)
    expect(unwrapTreeRoot(childWithoutChildren)).toBe(childWithoutChildren)
  })
})

describe('flattenTree', () => {
  it('returns data from leaf nodes only', () => {
    const tree: TreeNode = {
      key: 'root',
      label: 'root',
      children: [
        {
          key: 'folder',
          label: 'folder',
          children: [
            {
              key: 'leaf-a',
              label: 'leaf-a',
              leaf: true,
              data: { path: 'a' }
            },
            {
              key: 'leaf-b',
              label: 'leaf-b',
              leaf: true
            }
          ]
        },
        {
          key: 'leaf-c',
          label: 'leaf-c',
          leaf: true,
          data: { path: 'c' }
        }
      ]
    }

    expect(flattenTree<{ path: string }>(tree)).toEqual([
      { path: 'c' },
      { path: 'a' }
    ])
  })
})

describe('sortedTree', () => {
  it('should return a new node instance', () => {
    const node = createNode('root')
    const result = sortedTree(node)
    expect(result).not.toBe(node)
    expect(result).toEqual(node)
  })

  it('should sort children by label', () => {
    const node: TreeNode = {
      key: 'root',
      label: 'root',
      leaf: false,
      children: [createNode('c'), createNode('a'), createNode('b')]
    }

    const result = sortedTree(node)
    expect(result.children?.map((c) => c.label)).toEqual(['a', 'b', 'c'])
  })

  it('sorts children with missing labels by the empty-label fallback', () => {
    const unlabeled = {
      key: 'missing',
      label: undefined as unknown as string,
      leaf: true
    }
    const node: TreeNode = {
      key: 'root',
      label: 'root',
      leaf: false,
      children: [unlabeled, createNode('a', true)]
    }

    expect(sortedTree(node).children?.map((c) => c.key)).toEqual([
      'missing',
      'a'
    ])
  })

  describe('with groupLeaf=true', () => {
    it('should group folders before files', () => {
      const node: TreeNode = {
        key: 'root',
        label: 'root',
        children: [
          createNode('file.txt', true),
          createNode('folder1'),
          createNode('another.txt', true),
          createNode('folder2')
        ]
      }

      const result = sortedTree(node, { groupLeaf: true })
      const labels = result.children?.map((c) => c.label)
      expect(labels).toEqual(['folder1', 'folder2', 'another.txt', 'file.txt'])
    })

    it('sorts grouped children with missing labels', () => {
      const unlabeledFolder = {
        key: 'folder-missing',
        label: undefined as unknown as string,
        leaf: false,
        children: []
      }
      const unlabeledFile = {
        key: 'file-missing',
        label: undefined as unknown as string,
        leaf: true,
        children: []
      }
      const node: TreeNode = {
        key: 'root',
        label: 'root',
        children: [
          createNode('folder-b'),
          unlabeledFolder,
          createNode('file-b', true),
          unlabeledFile
        ]
      }

      expect(
        sortedTree(node, { groupLeaf: true }).children?.map((c) => c.key)
      ).toEqual(['folder-missing', 'folder-b', 'file-missing', 'file-b'])
    })

    it('should sort recursively', () => {
      const node: TreeNode = {
        key: 'root',
        label: 'root',
        children: [
          {
            ...createNode('folder1'),
            children: [
              createNode('z.txt', true),
              createNode('subfolder2'),
              createNode('a.txt', true),
              createNode('subfolder1')
            ]
          }
        ]
      }

      const result = sortedTree(node, { groupLeaf: true })
      const folder = result.children?.[0]
      const subLabels = folder?.children?.map((c) => c.label)
      expect(subLabels).toEqual(['subfolder1', 'subfolder2', 'a.txt', 'z.txt'])
    })
  })

  it('should handle nodes without children', () => {
    const node: TreeNode = {
      key: 'leaf',
      label: 'leaf',
      leaf: true
    }

    const result = sortedTree(node)
    expect(result).toEqual(node)
  })
})

describe('findNodeByKey', () => {
  it('returns the matching nested node or null', () => {
    const child = createNode('root/child')
    const tree: TreeNode = {
      key: 'root',
      label: 'root',
      children: [child]
    }

    expect(findNodeByKey(tree, 'root')).toBe(tree)
    expect(findNodeByKey(tree, 'root/child')).toBe(child)
    expect(findNodeByKey(tree, 'missing')).toBeNull()
    expect(findNodeByKey(createNode('root'), 'missing')).toBeNull()
  })
})

describe('combineTrees', () => {
  it('adds a cloned subtree under its matching parent', () => {
    const root: TreeNode = {
      key: 'root',
      label: 'root',
      children: [{ key: 'root/a', label: 'a', children: [] }]
    }
    const subtree: TreeNode = {
      key: 'root/a/b',
      label: 'b',
      leaf: true,
      data: { path: 'b' }
    }

    const combined = combineTrees(root, subtree)

    expect(combined).not.toBe(root)
    expect(combined.children?.[0].children?.[0]).toEqual(subtree)
    expect(combined.children?.[0].children?.[0]).not.toBe(subtree)
  })

  it('returns a clone unchanged when the parent key is absent', () => {
    const root: TreeNode = { key: 'root', label: 'root' }
    const combined = combineTrees(root, {
      key: 'root/missing/leaf',
      label: 'leaf',
      leaf: true
    })

    expect(combined).toEqual(root)
    expect(combined).not.toBe(root)
  })
})
