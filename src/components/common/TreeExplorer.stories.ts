import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { TreeExplorerNode } from '@/types/treeExplorerTypes'

import TreeExplorer from './TreeExplorer.vue'

const meta: Meta = {
  title: 'Components/Common/TreeExplorer',
  component: TreeExplorer as any,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'TreeExplorer provides a sophisticated tree navigation component with expandable nodes, selection, context menus, drag-and-drop support, and customizable node rendering. Features folder operations, renaming, deletion, and advanced tree manipulation capabilities.'
      }
    }
  },
  argTypes: {
    root: {
      control: 'object',
      description: 'Root tree node with hierarchical structure'
    },
    expandedKeys: {
      control: 'object',
      description: 'Object tracking which nodes are expanded (v-model)',
      defaultValue: {}
    },
    selectionKeys: {
      control: 'object',
      description: 'Object tracking which nodes are selected (v-model)',
      defaultValue: {}
    },
    class: {
      control: 'text',
      description: 'Additional CSS classes for the tree',
      defaultValue: undefined
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj

export const BasicTree: Story = {
  render: (args: any) => ({
    components: { TreeExplorer },
    setup() {
      return { args }
    },
    data() {
      return {
        expanded: {},
        selected: {},
        treeData: {
          key: 'root',
          label: 'Root',
          children: [
            {
              key: 'workflows',
              label: 'Workflows',
              icon: 'pi pi-sitemap',
              children: [
                {
                  key: 'portrait',
                  label: 'Portrait Generation.json',
                  icon: 'pi pi-file'
                },
                {
                  key: 'landscape',
                  label: 'Landscape SDXL.json',
                  icon: 'pi pi-file'
                },
                { key: 'anime', label: 'Anime Style.json', icon: 'pi pi-file' }
              ]
            },
            {
              key: 'models',
              label: 'Models',
              icon: 'pi pi-download',
              children: [
                {
                  key: 'checkpoints',
                  label: 'Checkpoints',
                  icon: 'pi pi-folder',
                  children: [
                    {
                      key: 'sdxl',
                      label: 'SDXL_base.safetensors',
                      icon: 'pi pi-file'
                    },
                    {
                      key: 'sd15',
                      label: 'SD_1.5.safetensors',
                      icon: 'pi pi-file'
                    }
                  ]
                },
                {
                  key: 'lora',
                  label: 'LoRA',
                  icon: 'pi pi-folder',
                  children: [
                    {
                      key: 'portrait_lora',
                      label: 'portrait_enhance.safetensors',
                      icon: 'pi pi-file'
                    }
                  ]
                }
              ]
            },
            {
              key: 'outputs',
              label: 'Outputs',
              icon: 'pi pi-images',
              children: [
                {
                  key: 'output1',
                  label: 'ComfyUI_00001_.png',
                  icon: 'pi pi-image'
                },
                {
                  key: 'output2',
                  label: 'ComfyUI_00002_.png',
                  icon: 'pi pi-image'
                }
              ]
            }
          ]
        } as TreeExplorerNode
      }
    },
    methods: {
      handleNodeClick(node: any, _event: MouseEvent) {
        console.log('Node clicked:', node.label)
      },
      handleNodeDelete(node: any) {
        console.log('Node delete requested:', node.label)
      },
      handleContextMenu(node: any, _event: MouseEvent) {
        console.log('Context menu on node:', node.label)
      }
    },
    template: `
      <div style="padding: 20px; width: 400px; height: 500px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">ComfyUI File Explorer</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Navigate through workflows, models, and outputs
          </p>
        </div>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; background: white; height: 400px; overflow: auto;">
          <TreeExplorer
            :root="treeData"
            v-model:expandedKeys="expanded"
            v-model:selectionKeys="selected"
            @nodeClick="handleNodeClick"
            @nodeDelete="handleNodeDelete"
            @contextMenu="handleContextMenu"
          />
        </div>
        <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
          Expanded: {{ Object.keys(expanded).length }} | Selected: {{ Object.keys(selected).length }}
        </div>
      </div>
    `
  }),
  args: {
    expandedKeys: { workflows: true, models: true },
    selectionKeys: { portrait: true }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Basic TreeExplorer with ComfyUI file structure showing workflows, models, and outputs.'
      }
    }
  }
}

export const EmptyTree: Story = {
  render: () => ({
    components: { TreeExplorer },
    data() {
      return {
        expanded: {},
        selected: {},
        emptyTree: {
          key: 'empty-root',
          label: 'Empty Workspace',
          children: []
        } as TreeExplorerNode
      }
    },
    methods: {
      handleNodeClick(node: any, event: MouseEvent) {
        console.log('Empty tree node clicked:', node, event)
      }
    },
    template: `
      <div style="padding: 20px; width: 350px; height: 300px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Empty Workspace</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Empty tree explorer state
          </p>
        </div>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; background: white; height: 200px; display: flex; align-items: center; justify-content: center;">
          <TreeExplorer
            :root="emptyTree"
            v-model:expandedKeys="expanded"
            v-model:selectionKeys="selected"
            @nodeClick="handleNodeClick"
          />
          <div style="color: #9ca3af; font-style: italic; text-align: center;">
            <i class="pi pi-folder-open" style="display: block; font-size: 24px; margin-bottom: 8px;"></i>
            No items in workspace
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Empty TreeExplorer showing the state when no items are present in the workspace.'
      }
    }
  }
}

export const DeepHierarchy: Story = {
  render: () => ({
    components: { TreeExplorer },
    data() {
      return {
        expanded: { workflows: true, 'stable-diffusion': true },
        selected: {},
        deepTree: {
          key: 'root',
          label: 'Projects',
          children: [
            {
              key: 'workflows',
              label: 'Workflows',
              icon: 'pi pi-sitemap',
              children: [
                {
                  key: 'stable-diffusion',
                  label: 'Stable Diffusion',
                  icon: 'pi pi-folder',
                  children: [
                    {
                      key: 'portraits',
                      label: 'Portraits',
                      icon: 'pi pi-folder',
                      children: [
                        {
                          key: 'realistic',
                          label: 'Realistic Portrait.json',
                          icon: 'pi pi-file'
                        },
                        {
                          key: 'artistic',
                          label: 'Artistic Portrait.json',
                          icon: 'pi pi-file'
                        }
                      ]
                    },
                    {
                      key: 'landscapes',
                      label: 'Landscapes',
                      icon: 'pi pi-folder',
                      children: [
                        {
                          key: 'nature',
                          label: 'Nature Scene.json',
                          icon: 'pi pi-file'
                        },
                        {
                          key: 'urban',
                          label: 'Urban Environment.json',
                          icon: 'pi pi-file'
                        }
                      ]
                    }
                  ]
                },
                {
                  key: 'controlnet',
                  label: 'ControlNet',
                  icon: 'pi pi-folder',
                  children: [
                    {
                      key: 'canny',
                      label: 'Canny Edge.json',
                      icon: 'pi pi-file'
                    },
                    {
                      key: 'depth',
                      label: 'Depth Map.json',
                      icon: 'pi pi-file'
                    }
                  ]
                }
              ]
            }
          ]
        } as TreeExplorerNode
      }
    },
    methods: {
      handleNodeClick(node: any, _event: MouseEvent) {
        console.log('Deep tree node clicked:', node.label)
      }
    },
    template: `
      <div style="padding: 20px; width: 400px; height: 600px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Deep Hierarchy</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Multi-level nested folder structure with organized workflows
          </p>
        </div>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; background: white; height: 500px; overflow: auto;">
          <TreeExplorer
            :root="deepTree"
            v-model:expandedKeys="expanded"
            v-model:selectionKeys="selected"
            @nodeClick="handleNodeClick"
          />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Deep hierarchical TreeExplorer showing multi-level folder organization with workflows.'
      }
    }
  }
}

export const InteractiveOperations: Story = {
  render: () => ({
    components: { TreeExplorer },
    data() {
      return {
        expanded: { workflows: true },
        selected: {},
        operationLog: [],
        interactiveTree: {
          key: 'root',
          label: 'Interactive Workspace',
          children: [
            {
              key: 'workflows',
              label: 'My Workflows',
              icon: 'pi pi-sitemap',
              children: [
                {
                  key: 'workflow1',
                  label: 'Image Generation.json',
                  icon: 'pi pi-file',
                  handleRename: function (newName: string) {
                    console.log(`Renaming workflow to: ${newName}`)
                  },
                  handleDelete: function () {
                    console.log('Deleting workflow')
                  }
                },
                {
                  key: 'workflow2',
                  label: 'Video Processing.json',
                  icon: 'pi pi-file',
                  handleRename: function (newName: string) {
                    console.log(`Renaming workflow to: ${newName}`)
                  },
                  handleDelete: function () {
                    console.log('Deleting workflow')
                  }
                }
              ]
            }
          ]
        } as TreeExplorerNode
      }
    },
    methods: {
      handleNodeClick(node: any, _event: MouseEvent) {
        this.operationLog.unshift(`Clicked: ${node.label}`)
        if (this.operationLog.length > 8) this.operationLog.pop()
      },
      handleNodeDelete(node: any) {
        this.operationLog.unshift(`Delete requested: ${node.label}`)
        if (this.operationLog.length > 8) this.operationLog.pop()
      },
      handleContextMenu(node: any, _event: MouseEvent) {
        this.operationLog.unshift(`Context menu: ${node.label}`)
        if (this.operationLog.length > 8) this.operationLog.pop()
      }
    },
    template: `
      <div style="padding: 20px; width: 500px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Interactive Operations</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Click nodes, right-click for context menu, test selection behavior
          </p>
        </div>
        
        <div style="display: flex; gap: 16px;">
          <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; background: white; height: 300px; overflow: auto;">
            <TreeExplorer
              :root="interactiveTree"
              v-model:expandedKeys="expanded"
              v-model:selectionKeys="selected"
              @nodeClick="handleNodeClick"
              @nodeDelete="handleNodeDelete"
              @contextMenu="handleContextMenu"
            />
          </div>
          
          <div style="flex: 1; background: rgba(0,0,0,0.05); border-radius: 8px; padding: 12px;">
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">Operation Log:</div>
            <div v-if="operationLog.length === 0" style="font-style: italic; color: #9ca3af; font-size: 12px;">
              No operations yet...
            </div>
            <div v-for="(entry, index) in operationLog" :key="index" style="font-size: 12px; color: #4b5563; margin-bottom: 2px; font-family: monospace;">
              {{ entry }}
            </div>
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Interactive TreeExplorer demonstrating click, context menu, and selection operations with live logging.'
      }
    }
  }
}

export const WorkflowManager: Story = {
  render: () => ({
    components: { TreeExplorer },
    data() {
      return {
        expanded: { 'workflow-library': true, 'my-workflows': true },
        selected: {},
        workflowTree: {
          key: 'root',
          label: 'Workflow Manager',
          children: [
            {
              key: 'my-workflows',
              label: 'My Workflows',
              icon: 'pi pi-user',
              children: [
                {
                  key: 'draft1',
                  label: 'Draft - SDXL Portrait.json',
                  icon: 'pi pi-file-edit'
                },
                {
                  key: 'final1',
                  label: 'Final - Product Shots.json',
                  icon: 'pi pi-file'
                },
                {
                  key: 'temp1',
                  label: 'Temp - Testing.json',
                  icon: 'pi pi-clock'
                }
              ]
            },
            {
              key: 'workflow-library',
              label: 'Workflow Library',
              icon: 'pi pi-book',
              children: [
                {
                  key: 'community',
                  label: 'Community',
                  icon: 'pi pi-users',
                  children: [
                    {
                      key: 'popular1',
                      label: 'SDXL Ultimate.json',
                      icon: 'pi pi-star-fill'
                    },
                    {
                      key: 'popular2',
                      label: 'ControlNet Pro.json',
                      icon: 'pi pi-star-fill'
                    }
                  ]
                },
                {
                  key: 'templates',
                  label: 'Templates',
                  icon: 'pi pi-clone',
                  children: [
                    {
                      key: 'template1',
                      label: 'Basic Generation.json',
                      icon: 'pi pi-file'
                    },
                    {
                      key: 'template2',
                      label: 'Img2Img Template.json',
                      icon: 'pi pi-file'
                    }
                  ]
                }
              ]
            },
            {
              key: 'recent',
              label: 'Recent',
              icon: 'pi pi-history',
              children: [
                {
                  key: 'recent1',
                  label: 'Last Session.json',
                  icon: 'pi pi-clock'
                },
                {
                  key: 'recent2',
                  label: 'Quick Test.json',
                  icon: 'pi pi-clock'
                }
              ]
            }
          ]
        } as TreeExplorerNode
      }
    },
    methods: {
      handleNodeClick(node: any, _event: MouseEvent) {
        console.log('Workflow selected:', node.label)
      }
    },
    template: `
      <div style="padding: 20px; width: 450px; height: 600px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Workflow Manager</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Organized workflow library with categories, templates, and recent files
          </p>
        </div>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; background: white; height: 500px; overflow: auto;">
          <TreeExplorer
            :root="workflowTree"
            v-model:expandedKeys="expanded"
            v-model:selectionKeys="selected"
            @nodeClick="handleNodeClick"
          />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Realistic workflow manager showing organized hierarchy with categories, templates, and recent files.'
      }
    }
  }
}

export const CompactView: Story = {
  render: () => ({
    components: { TreeExplorer },
    data() {
      return {
        expanded: { models: true },
        selected: {},
        compactTree: {
          key: 'root',
          label: 'Models',
          children: [
            {
              key: 'models',
              label: 'Checkpoints',
              icon: 'pi pi-download',
              children: [
                {
                  key: 'model1',
                  label: 'SDXL_base.safetensors',
                  icon: 'pi pi-file'
                },
                {
                  key: 'model2',
                  label: 'SD_1.5_pruned.safetensors',
                  icon: 'pi pi-file'
                },
                {
                  key: 'model3',
                  label: 'Realistic_Vision_V5.safetensors',
                  icon: 'pi pi-file'
                },
                {
                  key: 'model4',
                  label: 'AnythingV5_v3.safetensors',
                  icon: 'pi pi-file'
                }
              ]
            }
          ]
        } as TreeExplorerNode
      }
    },
    template: `
      <div style="padding: 20px; width: 300px; height: 400px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Compact Model List</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Compact view for smaller spaces
          </p>
        </div>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; background: white; height: 300px; overflow: auto;">
          <TreeExplorer
            :root="compactTree"
            v-model:expandedKeys="expanded"
            v-model:selectionKeys="selected"
            class="text-sm"
          />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Compact TreeExplorer view for smaller interface areas with minimal spacing.'
      }
    }
  }
}
