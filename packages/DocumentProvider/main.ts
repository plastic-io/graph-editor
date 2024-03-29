import type {Graph, Node} from "@plastic-io/plastic-io";
export interface Toc {
    [key: string]: TocItem;
}
export interface TocItem {
    id: string;
    lastUpdate: number;
    type: string;
    description: string;
    icon: string;
    name: string;
    version: number;
}
export interface GraphDiff {
    time: number
    crc: number,
    description: string,
    changes: object[]
}
export interface NodeArtifact {
    node: Node;
}
export interface GraphArtifact {
    graph: Graph;
}
export interface PreferencesArtifact {
    preferences: any;
}
export abstract class PreferencesProvider {
  abstract get(key: string): Promise<object>;
  abstract set(key: string, value: PreferencesArtifact): Promise<void>;
  
}
export default abstract class DocumentProvider {
  asyncUpdate: boolean;
  graph: null | Graph;
  constructor() {
      this.asyncUpdate = false;
      this.graph = null;
  }
  abstract updateToc(key: string, value: TocItem): Promise<void>;
  abstract subscribe(url: string | null, callback: (e: any) => void): Promise<void>;
  abstract get(url: string): Promise<Graph | any>;
  abstract getEvents(url: string): Promise<GraphDiff[] | any>;
  abstract set(url: string, value: GraphDiff | NodeArtifact | GraphArtifact | any): Promise<void>;
  abstract delete(url: string): Promise<void>;
}
