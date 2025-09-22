import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BatchCountEdit from './BatchCountEdit.vue'

const meta: Meta = {
  title: 'Components/Actionbar/BatchCountEdit',
  component: BatchCountEdit,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'BatchCountEdit allows users to set the batch count for queue operations with smart increment/decrement logic. Features exponential scaling (doubling/halving) and integrates with the queue settings store for ComfyUI workflow execution. This component can accept props for controlled mode or use Pinia store state by default.'
      }
    }
  },
  argTypes: {
    minQueueCount: {
      control: 'number',
      description: 'Minimum allowed batch count',
      table: {
        defaultValue: { summary: '1' }
      }
    },
    maxQueueCount: {
      control: 'number',
      description: 'Maximum allowed batch count',
      table: {
        defaultValue: { summary: '100' }
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj

export const Default: Story = {
  args: {
    minQueueCount: 1,
    maxQueueCount: 100
  },
  render: (_args) => ({
    components: { BatchCountEdit },
    data() {
      return {
        count: 1,
        logAction: (action: string, value: number) => {
          console.log(`${action}: ${value}`)
        }
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Batch Count Editor</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Set the number of times to run the workflow. Smart increment/decrement with exponential scaling.
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-weight: 600;">Batch Count:</span>
          <BatchCountEdit
            v-model:batch-count="count"
            :min-queue-count="+_args.minQueueCount"
            :max-queue-count="+_args.maxQueueCount"
            @update:batch-count="(v) => logAction('Set', Number(v))"
          />
        </div>
        <div style="font-size: 12px; color: #6b7280; background: rgba(0,0,0,0.05); padding: 12px; border-radius: 4px;">
          <strong>Note:</strong> Current value: {{count}}. Check console for action logs.
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Default batch count editor with smart exponential scaling. Uses Pinia store for state management. Click +/- buttons to see the doubling/halving behavior.'
      }
    }
  }
}

export const WithTooltip: Story = {
  args: {
    minQueueCount: 1,
    maxQueueCount: 50
  },
  render: (_args) => ({
    components: { BatchCountEdit },
    data() {
      return {
        count: 4,
        logAction: (action: string, value: number) => {
          console.log(`${action}: ${value}`)
        }
      }
    },
    template: `
      <div style="padding: 40px;">
        <div style="margin-bottom: 16px; text-align: center;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            Hover over the input to see tooltip
          </div>
          <BatchCountEdit
            v-model:batch-count="count"
            :min-queue-count="+_args.minQueueCount"
            :max-queue-count="+_args.maxQueueCount"
            @update:batch-count="(v) => logAction('Set', Number(v))"
          />
        </div>
        <div style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 20px;">
          ⬆️ Tooltip appears on hover with 600ms delay
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'BatchCountEdit with tooltip functionality - hover to see the "Batch Count" tooltip.'
      }
    }
  }
}

export const HighBatchCount: Story = {
  args: {
    minQueueCount: 1,
    maxQueueCount: 200
  },
  render: (_args) => ({
    components: { BatchCountEdit },
    data() {
      return {
        count: 16,
        logAction: (action: string, value: number) => {
          console.log(`${action}: ${value}`)
        }
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            High batch count scenario (16 generations):
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: 600;">Batch Count:</span>
            <BatchCountEdit
              v-model:batch-count="count"
              :min-queue-count="+_args.minQueueCount"
              :max-queue-count="+_args.maxQueueCount"
              @update:batch-count="(v) => logAction('Set', Number(v))"
            />
          </div>
        </div>
        <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 4px; padding: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; color: #b45309;">
            <i class="pi pi-exclamation-triangle"></i>
            <span style="font-size: 14px; font-weight: 600;">High Batch Count Warning</span>
          </div>
          <div style="font-size: 12px; color: #92400e; margin-top: 4px;">
            Running 16 generations will consume significant GPU time and memory. Consider reducing batch size for faster iteration.
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'High batch count scenario showing potential performance warnings for large generation batches.'
      }
    }
  }
}

export const ActionBarContext: Story = {
  args: {
    minQueueCount: 1,
    maxQueueCount: 100
  },
  render: (_args) => ({
    components: { BatchCountEdit },
    data() {
      return {
        count: 2,
        logAction: (action: string, value: number) => {
          console.log(`${action}: ${value}`)
        }
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          BatchCountEdit in realistic action bar context:
        </div>
        <div style="display: flex; align-items: center; gap: 16px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <!-- Mock Queue Button -->
          <button style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
            <i class="pi pi-play"></i>
            Queue Prompt
          </button>
          
          <!-- BatchCountEdit -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 12px; color: #6b7280; font-weight: 600;">BATCH:</label>
            <BatchCountEdit
              v-model:batch-count="count"
              :min-queue-count="+_args.minQueueCount"
              :max-queue-count="+_args.maxQueueCount"
              @update:batch-count="(v) => logAction('Set', Number(v))"
            />
          </div>
          
          <!-- Mock Clear Button -->
          <button style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">
            <i class="pi pi-trash"></i>
            Clear
          </button>
          
          <!-- Mock Settings -->
          <button style="padding: 8px; background: none; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
            <i class="pi pi-cog" style="color: #6b7280;"></i>
          </button>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'BatchCountEdit integrated within a realistic ComfyUI action bar layout with queue controls.'
      }
    }
  }
}

export const ExponentialScaling: Story = {
  args: {
    minQueueCount: 1,
    maxQueueCount: 100
  },
  render: (_args) => ({
    components: { BatchCountEdit },
    data() {
      return {
        scalingLog: [],
        currentValue: 1,
        count: 1,
        logAction: (action: string, value: number) => {
          console.log(`${action}: ${value}`)
        }
      }
    },
    methods: {
      simulateIncrement() {
        const current = this.currentValue
        const newValue = Math.min(current * 2, 100)
        this.scalingLog.unshift(`Increment: ${current} → ${newValue} (×2)`)
        this.currentValue = newValue
        if (this.scalingLog.length > 10) this.scalingLog.pop()
      },
      simulateDecrement() {
        const current = this.currentValue
        const newValue = Math.floor(current / 2) || 1
        this.scalingLog.unshift(`Decrement: ${current} → ${newValue} (÷2)`)
        this.currentValue = newValue
        if (this.scalingLog.length > 10) this.scalingLog.pop()
      },
      reset() {
        this.currentValue = 1
        this.scalingLog = []
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Exponential Scaling Demo</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Demonstrates the smart doubling/halving behavior of batch count controls.
          </p>
        </div>
        
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 600;">Current Value:</span>
            <span style="font-size: 18px; font-weight: bold; color: #3b82f6;">{{ currentValue }}</span>
          </div>
          <BatchCountEdit
            v-model:batch-count="count"
            :min-queue-count="+_args.minQueueCount"
            :max-queue-count="+_args.maxQueueCount"
            @update:batch-count="(v) => logAction('Set', Number(v))"
          />
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <button @click="simulateIncrement" style="padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">
            <i class="pi pi-plus"></i> Double
          </button>
          <button @click="simulateDecrement" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
            <i class="pi pi-minus"></i> Halve
          </button>
          <button @click="reset" style="padding: 6px 12px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">
            <i class="pi pi-refresh"></i> Reset
          </button>
        </div>
        
        <div v-if="scalingLog.length" style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 4px;">
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">Scaling Log:</div>
          <div v-for="(entry, index) in scalingLog" :key="index" style="font-size: 12px; color: #4b5563; margin-bottom: 2px; font-family: monospace;">
            {{ entry }}
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates the exponential scaling behavior - increment doubles the value, decrement halves it.'
      }
    }
  }
}

export const QueueWorkflowContext: Story = {
  args: {
    minQueueCount: 1,
    maxQueueCount: 50
  },
  render: (_args) => ({
    components: { BatchCountEdit },
    data() {
      return {
        queueStatus: 'Ready',
        totalGenerations: 1,
        estimatedTime: '~2 min',
        count: 1,
        logAction: (action: string, value: number) => {
          console.log(`${action}: ${value}`)
        }
      }
    },
    computed: {
      statusColor() {
        return this.queueStatus === 'Ready'
          ? '#10b981'
          : this.queueStatus === 'Running'
            ? '#f59e0b'
            : '#6b7280'
      }
    },
    methods: {
      updateEstimate() {
        // Simulate batch count change affecting estimates
        this.totalGenerations = 1 // This would be updated by actual batch count
        this.estimatedTime = `~${this.totalGenerations * 2} min`
      },
      queueWorkflow() {
        this.queueStatus = 'Running'
        setTimeout(() => {
          this.queueStatus = 'Complete'
        }, 3000)
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Queue Workflow Context</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            BatchCountEdit within a complete workflow queuing interface.
          </p>
        </div>
        
        <!-- Mock Workflow Preview -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <i class="pi pi-sitemap" style="color: #6366f1;"></i>
            <span style="font-weight: 600;">SDXL Portrait Generation</span>
            <span :style="{color: statusColor, fontSize: '12px', fontWeight: '600'}" style="background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 12px;">
              {{ queueStatus }}
            </span>
          </div>
          
          <!-- Queue Controls -->
          <div style="display: flex; align-items: center; gap: 12px; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <button @click="queueWorkflow" style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                <i class="pi pi-play"></i>
                Queue Prompt
              </button>
              
              <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; color: #6b7280; font-weight: 600;">BATCH:</label>
                <BatchCountEdit
                  v-model:batch-count="count"
                  :min-queue-count="+_args.minQueueCount"
                  :max-queue-count="+_args.maxQueueCount"
                  @update:batch-count="(v) => logAction('Set', Number(v))"
                />
              </div>
            </div>
            
            <div style="text-align: right;">
              <div style="font-size: 12px; color: #6b7280;">Total: {{ totalGenerations }} generations</div>
              <div style="font-size: 12px; color: #6b7280;">Est. time: {{ estimatedTime }}</div>
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
          'BatchCountEdit in a complete workflow queuing context with status and time estimates.'
      }
    }
  }
}

export const LimitConstraints: Story = {
  args: {
    minQueueCount: 1,
    maxQueueCount: 200
  },
  render: (_args) => ({
    components: { BatchCountEdit },
    data() {
      return {
        count: 1,
        logAction: (action: string, value: number) => {
          console.log(`${action}: ${value}`)
        },
        scenarios: [
          {
            name: 'Conservative (max 10)',
            maxLimit: 10,
            description: 'For memory-constrained systems'
          },
          {
            name: 'Standard (max 50)',
            maxLimit: 50,
            description: 'Typical production usage'
          },
          {
            name: 'High-end (max 200)',
            maxLimit: 200,
            description: 'For powerful GPU setups'
          }
        ]
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Limit Constraints</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Different batch count limits for various system configurations.
          </p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
          <div v-for="scenario in scenarios" :key="scenario.name" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
            <div style="font-weight: 600; margin-bottom: 4px;">{{ scenario.name }}</div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">{{ scenario.description }}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 600;">BATCH:</span>
              <BatchCountEdit
                v-model:batch-count="count"
                :min-queue-count="+_args.minQueueCount"
                :max-queue-count="+_args.maxQueueCount"
                @update:batch-count="(v) => logAction('Set', Number(v))"
              />
            </div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
              Max limit: {{ scenario.maxLimit }}
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
          'Different batch count limit scenarios for various system configurations and use cases.'
      }
    }
  }
}

export const MinimalInline: Story = {
  args: {
    minQueueCount: 1,
    maxQueueCount: 20
  },
  render: (_args) => ({
    components: { BatchCountEdit },
    data() {
      return {
        count: 3,
        logAction: (action: string, value: number) => {
          console.log(`${action}: ${value}`)
        }
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Minimal inline usage:
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
          <span>Run</span>
          <BatchCountEdit
            v-model:batch-count="count"
            :min-queue-count="+_args.minQueueCount"
            :max-queue-count="+_args.maxQueueCount"
            @update:batch-count="(v) => logAction('Set', Number(v))"
          />
          <span>times</span>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Minimal inline usage of BatchCountEdit within a sentence context.'
      }
    }
  }
}
