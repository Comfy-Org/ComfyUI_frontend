interface ReviewGuidanceWidget {
  options: {
    serialize?: boolean
  }
}

export function serializesWorkflowWidget(
  widget: ReviewGuidanceWidget
): boolean {
  return widget.options.serialize === true
}
