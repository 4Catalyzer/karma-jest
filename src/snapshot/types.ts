export interface SnapshotSuite {
  name: string;
  snapshots: Map<string, Snapshot>;
}

export interface SerializedSnapshotSuite {
  name: string;
  snapshots: Snapshot[];
}

export interface Snapshot {
  name: string;
  data: string;
  lang?: string;
}
