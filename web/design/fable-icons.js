// Fable 5.1 original 24px icon system, adapted for the existing six-tab MANU OS PWA.
// The memory dot is the visual signature. Trusted static markup only; no user-derived SVG.
const CLOUD = 'M7.5 17.5h9.25a3.75 3.75 0 0 0 .4-7.5 5.5 5.5 0 0 0-10.6 1.6A3 3 0 0 0 7.5 17.5z';
export const FABLE_ICONS = Object.freeze({
  hoy: '<circle cx="12" cy="12" r="8.25"/><circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none"/><path d="M12 3.75v2.5"/>',
  agenda: '<rect x="3.75" y="5" width="16.5" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.75 10h16.5"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/>',
  manu: '<path d="M4.5 19.5V5.5l7.5 7.5 7.5-7.5v14"/><circle cx="12" cy="17.5" r="1.6" fill="currentColor" stroke="none"/>',
  dinero: '<rect x="3" y="6" width="18" height="12.5" rx="2.75"/><path d="M3 10.25h18M7 14.75h4"/>',
  tu: '<circle cx="12" cy="8" r="3.75"/><path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0"/>',
  memoria: '<path d="M12 3.75a8.25 8.25 0 1 1-8.25 8.25"/><circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none"/>',
  recuerdos: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M5 15.5h14"/><circle cx="12" cy="9.5" r="2"/>',
  decisiones: '<path d="M12 20.25v-7.5M12 12.75 6.25 6.5M12 12.75l5.75-6.25"/><circle cx="12" cy="12.75" r="1.6" fill="currentColor" stroke="none"/>',
  ideas: '<circle cx="12" cy="9" r="5.25"/><path d="M9.75 17.5h4.5M10.5 20.25h3M10 13.75v3.75M14 13.75v3.75"/>',
  proyectos: '<path d="M4 7h10M4 12h16M4 17h7"/><circle cx="18" cy="17" r="1.6" fill="currentColor" stroke="none"/>',
  conexiones: '<circle cx="6" cy="6.5" r="2.25"/><circle cx="18" cy="6.5" r="2.25"/><circle cx="12" cy="18" r="2.25"/><path d="M8.25 6.5h7.5M7 8.5l4 7.5M17 8.5l-4 7.5"/>',
  ubicacion: '<path d="M12 20.75s-6.25-5.4-6.25-10.75a6.25 6.25 0 0 1 12.5 0c0 5.35-6.25 10.75-6.25 10.75z"/><circle cx="12" cy="10" r="1.75" fill="currentColor" stroke="none"/>',
  salud: '<path d="M3 12.5h3.75l2.25-5.25 4 10.5 2.25-5.25H21"/>',
  musica: '<path d="M10 17.5V5.75l8.5-2v11.5"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16" cy="15.25" r="2.5"/>',
  tiempo: `<path d="${CLOUD}"/><path d="M9.5 20.25l-.5 1.25M13.5 20.25l-.5 1.25"/>`,
  hogar: '<path d="M4 11.25 12 4.5l8 6.75"/><path d="M6.25 9.75v10.5h11.5V9.75"/><path d="M10 20.25v-4.75h4v4.75"/>',
  amanecer: '<path d="M3.5 17.5h17"/><path d="M7.25 17.5a4.75 4.75 0 0 1 9.5 0"/><path d="M12 8.5V6M5.75 10.75l1.5 1.5M18.25 10.75l-1.5 1.5"/>',
  notificaciones: '<path d="M6.25 16.25V11a5.75 5.75 0 0 1 11.5 0v5.25l1.5 1.75H4.75z"/><path d="M10 20.5h4"/>',
  seguridad: '<path d="M12 3.25 19.25 6v6c0 4.75-3.25 7.75-7.25 8.75C8 19.75 4.75 16.75 4.75 12V6z"/><path d="M9 12.25l2 2 4-4.25"/>',
  privacidad: '<rect x="5" y="10.75" width="14" height="10" rx="2.5"/><path d="M8.25 10.75V7.75a3.75 3.75 0 0 1 7.5 0v3"/><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none"/>',
  nube: `<path d="${CLOUD}"/><circle cx="12" cy="13.25" r="1.5" fill="currentColor" stroke="none"/>`,
  aprendizaje: '<path d="M3.5 20.25h5v-5h5v-5h5v-5"/><circle cx="20" cy="4" r="1.5" fill="currentColor" stroke="none"/>',
  estadisticas: '<path d="M5.5 20V12.5M12 20V5.5M18.5 20v-4.5"/><path d="M3.5 20h17"/>',
  capturas: '<path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/><circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none"/>',
  archivo: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5.25 9v9.25a1.75 1.75 0 0 0 1.75 1.75h10a1.75 1.75 0 0 0 1.75-1.75V9"/><path d="M10 13.25h4"/>',
  laboratorio: '<path d="M9.25 3.5v6.25L4.5 18a2 2 0 0 0 1.75 3h11.5A2 2 0 0 0 19.5 18l-4.75-8.25V3.5"/><path d="M8 3.5h8"/><circle cx="12" cy="16.5" r="1.5" fill="currentColor" stroke="none"/>',
  humor: '<circle cx="12" cy="12" r="8.25"/><path d="M8.5 14.25a3.75 3.75 0 0 0 7 0"/><circle cx="9.25" cy="9.75" r="1" fill="currentColor" stroke="none"/><path d="M13.5 9.75h2.25"/>',
  correccion: '<path d="M4.5 9.75h10.25a4.75 4.75 0 0 1 0 9.5H10"/><path d="M8.25 6 4.5 9.75l3.75 3.75"/>',
  confirmacion: '<circle cx="12" cy="12" r="8.25"/><path d="M8.25 12.25l2.5 2.5 5.25-5.5"/>',
  contradiccion: '<path d="M5 9h14M5 15h14"/><path d="M15 5 9 19"/>',
  automatizaciones: '<path d="M13.25 2.75 5.5 13.25h6l-1 8 7.75-10.5h-6z"/>',
  // An adaptation of the existing Bahía glyph; this feature was not in the Fable prototype.
  bahia: '<path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17M3 21c2 0 2-1.5 4.5-1.5S10 21 12 21s2.5-1.5 4.5-1.5S19 21 21 21"/><path d="M6 13V8l3-2 3 2v5M15 13V5h3v8"/>',
});
export const FABLE_ICON_NAMES = Object.freeze(Object.keys(FABLE_ICONS));
export function fableIcon(name, size = 24) {
  const markup = FABLE_ICONS[name];
  if (!markup) throw new RangeError("Unknown icon");
  const px = Number.isFinite(size) ? Math.max(12, Math.min(48, Math.round(size))) : 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-fable-icon="${name}">${markup}</svg>`;
}
export function fableMark(size = 24) {
  const px = Number.isFinite(size) ? Math.max(12, Math.min(48, Math.round(size))) : 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${px}" height="${px}" fill="none" aria-hidden="true"><path d="M16 46V18l16 16 16-16v28" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="42" r="4.2" fill="currentColor"/></svg>`;
}
