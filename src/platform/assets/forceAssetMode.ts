// SPIKE — do not merge. Forces the in-node model picker down its isCloud
// codepaths (asset-browser widgets, assets-store data source, base-model
// sort/filters) so a desktop/localhost build can run against a Core that
// implements the assets API. The sidebar Model Library no longer needs
// forcing (assets API on every distribution since #12634). Media branches
// (cloud input/output assets) stay distribution-gated because they depend
// on cloud-only data.
export const forceModelPickerAssetMode = true
