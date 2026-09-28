// Notifications for the installed web app. On iPhone they only work after
// "Añadir a pantalla de inicio" (TEÓRICAMENTE_POSIBLE, iOS 16.4+, not tested on
// Manu's iPhone). Scheduled reminders need a push server: not built (ADR-0012).
export function notificationStatus(env = globalThis) {
  if (!("Notification" in env) || !env.navigator?.serviceWorker) return "unsupported";
  return env.Notification.permission; // "default" | "granted" | "denied"
}

export function isInstalled(env = globalThis) {
  return Boolean(env.matchMedia?.("(display-mode: standalone)").matches || env.navigator?.standalone);
}

export async function enableNotifications(env = globalThis) {
  if (notificationStatus(env) === "unsupported") return "unsupported";
  return env.Notification.requestPermission();
}

export async function testNotification(env = globalThis) {
  if (notificationStatus(env) !== "granted") return false;
  const reg = await env.navigator.serviceWorker.ready;
  await reg.showNotification("MANU", { body: "Los avisos funcionan en este dispositivo.", tag: "manu-test", icon: "icons/icon-192.png" });
  return true;
}
