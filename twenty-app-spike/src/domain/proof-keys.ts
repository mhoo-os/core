export const RECOVERY_SWEEP_MARKER_KEY =
  'feasibility:recovery-sweep-observed';

export const getSyntheticFailureMarkerKey = (runId: string): string =>
  `feasibility:fail-once:${runId}`;

export const sourceCreatedReceiptKey = (sourceId: string): string =>
  `feasibility:source-created:${sourceId}`;
