import type { APITaskType, JobListItem, TaskType } from './jobTypes'
import type { TaskOutput } from '@comfyorg/api-client/executionTypes'
import type { AugmentedResultItem } from '@comfyorg/api-client/results/resultItem'
import { filterPreviewableResults } from '@comfyorg/api-client/results/resultItem'
import { parseTaskOutput } from '@comfyorg/api-client/results/resultItemParsing'
enum TaskItemDisplayStatus {
  Running = 'Running',
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}
export class TaskItemImpl {
  readonly job: JobListItem
  readonly outputs: TaskOutput
  readonly flatOutputs: ReadonlyArray<AugmentedResultItem>
  constructor(
    job: JobListItem,
    outputs?: TaskOutput,
    flatOutputs?: ReadonlyArray<AugmentedResultItem>
  ) {
    this.job = job
    const effectiveOutputs =
      outputs ??
      (job.preview_output
        ? {
            [job.preview_output.nodeId]: {
              [job.preview_output.mediaType]: [job.preview_output]
            }
          }
        : {})
    this.outputs = effectiveOutputs
    this.flatOutputs = flatOutputs ?? this.calculateFlatOutputs()
  }
  calculateFlatOutputs(): ReadonlyArray<AugmentedResultItem> {
    return parseTaskOutput(this.outputs)
  }
  get previewableOutputs(): readonly AugmentedResultItem[] {
    return filterPreviewableResults(this.flatOutputs)
  }
  get previewOutput(): AugmentedResultItem | undefined {
    const previewable = this.previewableOutputs
    return (
      previewable.findLast((output) => output.type === 'output') ??
      previewable.at(-1)
    )
  }
  get taskType(): TaskType {
    switch (this.job.status) {
      case 'in_progress':
        return 'Running'
      case 'pending':
        return 'Pending'
      default:
        return 'History'
    }
  }
  get apiTaskType(): APITaskType {
    switch (this.taskType) {
      case 'Running':
      case 'Pending':
        return 'queue'
      case 'History':
        return 'history'
    }
  }
  get key() {
    return this.jobId + this.displayStatus
  }
  get jobId() {
    return this.job.id
  }
  get outputsCount(): number | undefined {
    return this.job.outputs_count ?? undefined
  }
  get previewableOutputsCount(): number | undefined {
    return this.job.previewable_outputs_count ?? undefined
  }
  get status() {
    return this.job.status
  }
  get errorMessage(): string | undefined {
    return this.job.execution_error?.exception_message ?? undefined
  }
  get executionError() {
    return this.job.execution_error ?? undefined
  }
  get workflowId(): string | undefined {
    return this.job.workflow_id ?? undefined
  }
  get createTime(): number {
    return this.job.create_time
  }
  get interrupted(): boolean {
    return (
      this.job.status === 'failed' &&
      this.job.execution_error?.exception_type ===
        'InterruptProcessingException'
    )
  }
  get isHistory() {
    return this.taskType === 'History'
  }
  get isRunning() {
    return this.taskType === 'Running'
  }
  get displayStatus(): TaskItemDisplayStatus {
    switch (this.job.status) {
      case 'in_progress':
        return TaskItemDisplayStatus.Running
      case 'pending':
        return TaskItemDisplayStatus.Pending
      case 'completed':
        return TaskItemDisplayStatus.Completed
      case 'failed':
        return TaskItemDisplayStatus.Failed
      case 'cancelled':
        return TaskItemDisplayStatus.Cancelled
    }
  }
  get executionStartTimestamp() {
    return this.job.execution_start_time ?? undefined
  }
  get executionEndTimestamp() {
    return this.job.execution_end_time ?? undefined
  }
  get executionTime() {
    if (!this.executionStartTimestamp || !this.executionEndTimestamp) {
      return undefined
    }
    return this.executionEndTimestamp - this.executionStartTimestamp
  }
  get executionTimeInSeconds() {
    return this.executionTime !== undefined
      ? this.executionTime / 1000
      : undefined
  }
  public flatten(): TaskItemImpl[] {
    if (this.displayStatus !== TaskItemDisplayStatus.Completed) {
      return [this]
    }
    return this.flatOutputs.map(
      (output: AugmentedResultItem, i: number) =>
        new TaskItemImpl(
          {
            ...this.job,
            id: `${this.jobId}-${i}`
          },
          {
            [output.nodeId]: {
              [output.mediaType]: [output]
            }
          },
          [output]
        )
    )
  }
}
