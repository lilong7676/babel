import NodePath from "./path";
import { VISITOR_KEYS } from "@babel/types";
import type Scope from "./scope";
import type { TraverseOptions } from ".";
import type * as t from "@babel/types";
import type { Visitor } from "./types";

export default class TraversalContext<S = unknown> {
  constructor(
    scope: Scope,
    opts: TraverseOptions,
    state: S,
    parentPath: NodePath,
  ) {
    this.parentPath = parentPath;
    this.scope = scope;
    this.state = state;
    this.opts = opts;
  }

  declare parentPath: NodePath;
  declare scope: Scope;
  declare state: S;
  declare opts: TraverseOptions;
  queue: Array<NodePath> | null = null;
  priorityQueue: Array<NodePath> | null = null;

  /**
   * This method does a simple check to determine whether or not we really need to attempt
   * visit a node. This will prevent us from constructing a NodePath.
   */

  shouldVisit(node: t.Node): boolean {
    const opts = this.opts as Visitor;
    if (opts.enter || opts.exit) return true;

    // check if we have a visitor for this node
    if (opts[node.type]) return true;

    // check if we're going to traverse into this node
    const keys: Array<string> | undefined = VISITOR_KEYS[node.type];
    if (!keys?.length) return false;

    // we need to traverse into this node so ensure that it has children to traverse into!
    for (const key of keys) {
      if (
        // @ts-expect-error key is from visitor keys
        node[key]
      ) {
        return true;
      }
    }

    return false;
  }

  create(
    node: t.Node,
    container: t.Node | t.Node[],
    key: string | number,
    listKey?: string,
  ): NodePath {
    // We don't need to `.setContext()` here, since `.visitQueue()` already
    // calls `.pushContext`.
    return NodePath.get({
      parentPath: this.parentPath,
      parent: node,
      container,
      key: key,
      listKey,
    });
  }

  maybeQueue(path: NodePath, notPriority?: boolean) {
    if (this.queue) {
      if (notPriority) {
        this.queue.push(path);
      } else {
        this.priorityQueue.push(path);
      }
    }
  }

  visitMultiple(container: t.Node[], parent: t.Node, listKey: string) {
    // nothing to traverse!
    if (container.length === 0) return false;

    const queue = [];

    // build up initial queue
    for (let key = 0; key < container.length; key++) {
      const node = container[key];
      if (node && this.shouldVisit(node)) {
        queue.push(this.create(parent, container, key, listKey));
      }
    }

    return this.visitQueue(queue);
  }

  visitSingle(node: t.Node, key: string): boolean {
    if (
      this.shouldVisit(
        // @ts-expect-error key may not index node
        node[key],
      )
    ) {
      // 开始遍历
      return this.visitQueue([this.create(node, node, key)]);
    } else {
      return false;
    }
  }

  visitQueue(queue: Array<NodePath>): boolean {
    // set queue
    this.queue = queue;
    this.priorityQueue = [];

    const visited = new WeakSet();
    let stop = false;

    // visit the queue
    for (const path of queue) {
      path.resync();

      if (
        path.contexts.length === 0 ||
        path.contexts[path.contexts.length - 1] !== this
      ) {
        // The context might already have been pushed when this path was inserted and queued.
        // If we always re-pushed here, we could get duplicates and risk leaving contexts
        // on the stack after the traversal has completed, which could break things.
        path.pushContext(this);
      }

      // this path no longer belongs to the tree
      if (path.key === null) continue;

      // ensure we don't visit the same node twice
      const { node } = path;
      if (visited.has(node)) continue;
      if (node) visited.add(node);

      // 真正的调用遍历方法
      if (path.visit()) {
        stop = true;
        break;
      }

      if (this.priorityQueue.length) {
        stop = this.visitQueue(this.priorityQueue);
        this.priorityQueue = [];
        this.queue = queue;
        if (stop) break;
      }
    }

    // clear queue
    for (const path of queue) {
      path.popContext();
    }

    // clear queue
    this.queue = null;

    return stop;
  }

  visit(node: t.Node, key: string) {
    // @ts-expect-error key may not index node
    const nodes = node[key] as t.Node | t.Node[] | null;
    if (!nodes) return false;

    if (Array.isArray(nodes)) {
      return this.visitMultiple(nodes, node, key);
    } else {
      // 遍历 单node
      return this.visitSingle(node, key);
    }
  }
}
