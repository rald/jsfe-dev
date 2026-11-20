/**
 * Factory Pattern: Centralizes instantiation of MVC widget triples.
 */
export class ComponentFactory {
  constructor() {
    this._registry = new Map();
  }

  register(type, creatorFn) {
    this._registry.set(type.toLowerCase(), creatorFn);
  }

  create(type, options = {}) {
    const creator = this._registry.get(type.toLowerCase());
    if (!creator) {
      throw new Error(`Unknown GUI component type: "${type}"`);
    }
    return creator(options);
  }
}
