/**
 * Composite Pattern: Hierarchical tree structure for retained-mode UI elements.
 */
export class SceneNode {
  constructor() {
    this.parent = null;
    this.children = [];
  }

  add(child) {
    if (child.parent) {
      child.parent.remove(child);
    }
    child.parent = this;
    this.children.push(child);
    return this;
  }

  bringToFront(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1 && idx !== this.children.length - 1) {
      this.children.splice(idx, 1);
      this.children.push(child);
    }
    return this;
  }

  remove(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parent = null;
    }
    return this;
  }

  traverse(callback) {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  traverseReverse(callback) {
    for (let i = this.children.length - 1; i >= 0; i--) {
      const result = this.children[i].traverseReverse(callback);
      if (result) return result;
    }
    return callback(this);
  }
}
