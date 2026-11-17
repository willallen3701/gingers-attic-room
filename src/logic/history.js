// Undo/redo stack of editor snapshots. Snapshots are stored as JSON strings, so later mutation of
// an object passed in can never change history. Pushing a snapshot equal to the present is a no-op.

export function createHistory(limit = 100) {
  if (!(limit >= 1)) throw new RangeError('limit must be >= 1');
  let past = [];
  let future = [];
  let present = null;
  return {
    /** Start over with `state` as the only entry (e.g. after load-editor). */
    reset(state) {
      past = [];
      future = [];
      present = JSON.stringify(state);
    },
    /** Record a new state; clears the redo stack. Returns false if nothing changed. */
    push(state) {
      const s = JSON.stringify(state);
      if (s === present) return false;
      if (present !== null) past.push(present);
      if (past.length > limit) past = past.slice(past.length - limit);
      present = s;
      future = [];
      return true;
    },
    undo() {
      if (!past.length) return null;
      future.push(present);
      present = past.pop();
      return JSON.parse(present);
    },
    redo() {
      if (!future.length) return null;
      past.push(present);
      present = future.pop();
      return JSON.parse(present);
    },
    get present() {
      return present === null ? null : JSON.parse(present);
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    get depth() {
      return past.length;
    },
  };
}
