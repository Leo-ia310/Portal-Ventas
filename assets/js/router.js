import { getAppContext, hasSupabaseConfig, signOut, supabase } from "./supabase.js";
import { renderDashboard, renderPrices, renderSalesProcess } from "./dashboard.js";
import { renderLeads } from "./leads.js?v=2";
import { renderAdmin } from "./admin.js";
import { renderCommissions } from "./commissions.js";
import { renderTraining } from "./training.js";
import { renderScripts } from "./scripts.js";
import { renderReports } from "./reports.js";
import { renderDocuments } from "./documents.js";

const app = document.querySelector("#app");
const title = document.querySelector("#section-title");
const kicker = document.querySelector("#section-kicker");
const systemMessage = document.querySelector("#system-message");
const navButtons = [...document.querySelectorAll("[data-route]")];
const adminOnly = [...document.querySelectorAll(".admin-only")];

const routes = {
  dashboard: { title: "Dashboard", kicker: "Operación comercial", render: renderDashboard },
  leads: { title: "Leads / CRM", kicker: "Prospección y seguimiento", render: renderLeads },
  ventas: { title: "Proceso de ventas", kicker: "Reglas comerciales", render: renderSalesProcess },
  precios: { title: "Servicios y precios", kicker: "Consulta interna", render: renderPrices },
  training: { title: "Capacitación", kicker: "Ruta del agente", render: renderTraining },
  scripts: { title: "Guiones y mensajes", kicker: "Biblioteca comercial", render: renderScripts },
  commissions: { title: "Comisiones", kicker: "Ventas cerradas y pagadas", render: renderCommissions },
  reports: { title: "Reportes", kicker: "Actividad diaria y semanal", render: renderReports },
  documents: { title: "Documentos", kicker: "Recursos comerciales", render: renderDocuments },
  admin: { title: "Panel admin de Maikel", kicker: "Supervisión completa", render: renderAdmin, admin: true },
};

const state = {
  client: supabase,
  route: new URLSearchParams(window.location.search).get("route") || "dashboard",
};

async function boot() {
  if (!hasSupabaseConfig()) {
    systemMessage.hidden = false;
    systemMessage.innerHTML =
      "Falta configurar Supabase. Copia <strong>assets/js/config.example.js</strong> como <strong>assets/js/config.js</strong> y agrega la URL y anon key públicas.";
    app.innerHTML = "";
    return;
  }

  try {
    Object.assign(state, await getAppContext());
    if (!state.user) {
      window.location.replace("login.html");
      return;
    }
    hydrateUser();
    bindEvents();
    await navigate(state.isAdmin && state.route === "dashboard" ? "admin" : state.route);
  } catch (error) {
    console.error(error);
    window.location.replace("login.html");
  }
}

function hydrateUser() {
  document.querySelector("#user-name").textContent = state.profile.full_name || state.user.email;
  document.querySelector("#user-email").textContent = state.user.email;
  document.querySelector("#role-label").textContent = state.isAdmin ? "Admin" : "Agente";
  adminOnly.forEach((node) => {
    node.hidden = !state.isAdmin;
  });
}

function bindEvents() {
  navButtons.forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });
  document.querySelector("#logout-button").addEventListener("click", signOut);
  document.querySelector("#mobile-menu-button").addEventListener("click", () => {
    document.body.classList.toggle("menu-open");
  });
}

export async function navigate(routeName) {
  const route = routes[routeName] || routes.dashboard;
  if (route.admin && !state.isAdmin) routeName = "dashboard";
  const resolved = routes[routeName] || routes.dashboard;

  state.route = routeName;
  title.textContent = resolved.title;
  kicker.textContent = resolved.kicker;
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.route === routeName));
  document.body.classList.remove("menu-open");
  app.innerHTML = `<div class="empty-state">Cargando ${resolved.title.toLowerCase()}...</div>`;

  try {
    await resolved.render(app, state, navigate);
    history.replaceState(null, "", `dashboard.html?route=${routeName}`);
  } catch (error) {
    console.error(error);
    app.innerHTML = `<div class="empty-state text-danger">${error.message || "No se pudo cargar este módulo."}</div>`;
  }
}

boot();
