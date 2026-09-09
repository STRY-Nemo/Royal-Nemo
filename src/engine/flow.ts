/**
 * Small deterministic min-cost max-flow (successive shortest paths with
 * Bellman-Ford). Graph sizes here are tiny (about 100 candidates, a handful
 * of teams), so simplicity and determinism matter more than speed.
 */

interface Edge {
  to: number;
  rev: number;
  cap: number;
  cost: number;
}

export class MinCostFlow {
  private graph: Edge[][];

  constructor(nodeCount: number) {
    this.graph = Array.from({ length: nodeCount }, () => []);
  }

  addEdge(from: number, to: number, cap: number, cost: number): void {
    this.graph[from].push({ to, rev: this.graph[to].length, cap, cost });
    this.graph[to].push({ to: from, rev: this.graph[from].length - 1, cap: 0, cost: -cost });
  }

  /** Runs min-cost max-flow from source to sink. */
  run(source: number, sink: number): { flow: number; cost: number } {
    const n = this.graph.length;
    let flow = 0;
    let cost = 0;
    for (;;) {
      const dist = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
      const inQueue = new Array<boolean>(n).fill(false);
      const prevNode = new Array<number>(n).fill(-1);
      const prevEdge = new Array<number>(n).fill(-1);
      dist[source] = 0;
      const queue: number[] = [source];
      inQueue[source] = true;
      while (queue.length) {
        const u = queue.shift() as number;
        inQueue[u] = false;
        const edges = this.graph[u];
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          if (e.cap > 0 && dist[u] + e.cost < dist[e.to]) {
            dist[e.to] = dist[u] + e.cost;
            prevNode[e.to] = u;
            prevEdge[e.to] = i;
            if (!inQueue[e.to]) {
              inQueue[e.to] = true;
              queue.push(e.to);
            }
          }
        }
      }
      if (dist[sink] === Number.POSITIVE_INFINITY) break;
      // Bottleneck along the path.
      let add = Number.POSITIVE_INFINITY;
      for (let v = sink; v !== source; v = prevNode[v]) {
        const e = this.graph[prevNode[v]][prevEdge[v]];
        add = Math.min(add, e.cap);
      }
      for (let v = sink; v !== source; v = prevNode[v]) {
        const e = this.graph[prevNode[v]][prevEdge[v]];
        e.cap -= add;
        this.graph[v][e.rev].cap += add;
      }
      flow += add;
      cost += add * dist[sink];
    }
    return { flow, cost };
  }

  /** Residual capacity of the reverse edge equals the flow sent on the forward edge. */
  flowOn(from: number, edgeIndex: number): number {
    const e = this.graph[from][edgeIndex];
    return this.graph[e.to][e.rev].cap;
  }

  outEdges(from: number): ReadonlyArray<Readonly<Edge>> {
    return this.graph[from];
  }
}
