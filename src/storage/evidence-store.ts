export type EvidenceObject = {
  body: Uint8Array;
  contentType: string;
  sha256: string;
};

export interface EvidenceStore {
  exists(key: string): Promise<boolean>;
  get(key: string): Promise<EvidenceObject | undefined>;
  put(key: string, object: EvidenceObject): Promise<{ created: boolean }>;
}
