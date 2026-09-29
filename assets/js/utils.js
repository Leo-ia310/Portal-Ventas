export const LEAD_STATUSES = [
  "Nuevo",
  "Contactado",
  "Interesado",
  "Calificado",
  "Llamada agendada",
  "Propuesta enviada",
  "Negociación",
  "Ganado",
  "Perdido",
  "Seguimiento futuro",
];

export const COMMISSION_STATUSES = ["estimada", "aprobada", "pagada", "anulada"];

export const SCRIPT_CATEGORIES = [
  "Primer mensaje restaurante o comida",
  "Primer mensaje tienda o negocio general",
  "Primer mensaje profesional independiente",
  "Seguimiento si no responde",
  "Respuesta cuando muestra interés",
  "Mensaje para proponer llamada",
  "Mensaje para presentar portafolio y precio",
  "Objeciones frecuentes",
];

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function money(value = 0) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function dateValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function dateTimeValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

export function niceDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(new Date(value));
}

export function leadBadge(status) {
  const style =
    status === "Ganado" ? "success" : status === "Perdido" ? "danger" : status?.includes("Seguimiento") ? "warning" : "";
  return `<span class="badge ${style}">${escapeHtml(status || "Sin estado")}</span>`;
}

export function commissionBadge(status) {
  const style = status === "pagada" ? "success" : status === "anulada" ? "danger" : status === "aprobada" ? "warning" : "";
  return `<span class="badge ${style}">${escapeHtml(status || "estimada")}</span>`;
}

export function optionList(items, selected = "") {
  return items
    .map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`)
    .join("");
}

export function serializeForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function showMessage(target, message, type = "success") {
  if (!target) return;
  target.textContent = message;
  target.className = `form-message ${type}`;
}

export function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

export function requireAdmin(state) {
  if (!state.isAdmin) {
    throw new Error("Esta acción requiere rol admin.");
  }
}

export async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const previous = button.textContent;
  button.textContent = "Copiado";
  setTimeout(() => {
    button.textContent = previous;
  }, 1200);
}

