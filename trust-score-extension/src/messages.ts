import type { DetectedTarget } from './detect';
import type { ScanResult } from './lookup';

export type View =
  | { status: 'idle' }
  | { status: 'loading'; target: DetectedTarget }
  | { status: 'error'; message: string; target: DetectedTarget }
  | { status: 'done'; target: DetectedTarget; result: ScanResult };

export interface ScanRequest {
  type: 'scan';
  target: DetectedTarget;
}

export type ScanResponse =
  | { ok: true; result: ScanResult }
  | { ok: false; message: string };
