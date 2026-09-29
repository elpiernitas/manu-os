// Capture tray: MANU proposes, Manu confirms. Nothing is classified on its own.
export function capture({ id, text, at }) {
  return { id, text, at, status: "PENDING" };
}

export function confirm(item, as) {
  if (!["IDEA", "TASK"].includes(as)) throw new Error(`Unknown kind ${as}`);
  if (item.status !== "PENDING") return item;
  return { ...item, status: as };
}

export function markUnclassified(item) {
  return item.status === "PENDING" ? { ...item, status: "UNCLASSIFIED" } : item;
}

export const pending = (items) => items.filter((i) => i.status === "PENDING");
export const tasks = (items) => items.filter((i) => i.status === "TASK" && !i.done);
export const ideas = (items) => items.filter((i) => i.status === "IDEA");

export function toggleDone(item, now = new Date()) {
  // WEB-46: doneAt lets the evening summary count what Manu finished today.
  return item.status === "TASK" ? { ...item, done: !item.done, doneAt: item.done ? null : now.toISOString() } : item;
}
