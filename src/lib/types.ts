import type { Layout } from './layout';
import type { Band, Branch, Milestone, Settings } from './schemas';

export type ClientBranch = Branch;

export interface ClientNode extends Omit<Milestone, 'draft' | 'sortOffset' | 'label'> {
  label: string;
  /** Ids of nodes that list this one as a prerequisite. */
  unlocks: string[];
  /** Rendered markdown description. */
  html: string;
}

export interface TreeData {
  branches: ClientBranch[];
  nodes: ClientNode[];
  bands: Band[];
  /** `all` = six-column layout; plus one single-column layout per branch id. */
  layouts: Record<string, Layout>;
  settings: Settings;
}
