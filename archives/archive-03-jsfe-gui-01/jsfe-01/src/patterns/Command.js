/**
 * Command Pattern: Encapsulates actions as objects for undo/redo or deferred execution.
 */
export class Command {
  execute() {
    throw new Error('Command.execute() must be implemented');
  }

  undo() {
    throw new Error('Command.undo() must be implemented');
  }
}

export class CommandHistory {
  constructor() {
    this._undoStack = [];
    this._redoStack = [];
  }

  execute(command) {
    command.execute();
    this._undoStack.push(command);
    this._redoStack.length = 0;
  }

  undo() {
    const cmd = this._undoStack.pop();
    if (cmd) {
      cmd.undo();
      this._redoStack.push(cmd);
    }
  }

  redo() {
    const cmd = this._redoStack.pop();
    if (cmd) {
      cmd.execute();
      this._undoStack.push(cmd);
    }
  }
}
