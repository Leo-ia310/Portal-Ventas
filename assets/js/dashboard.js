import { emptyState, escapeHtml, leadBadge, money, niceDate } from "./utils.js";

const quickLinks = [
  ["precios", "Precios"],
  ["scripts", "Guiones"],
  ["training", "Manual de ventas"],
  ["ventas", "Proceso de cierre"],
];

export async function renderDashboard(container, state, navigate) {
  const { client, isAdmin, agent } = state;
  if (isAdmin) {
    container.innerHTML = emptyState("El usuario admin inicia en el panel de Maikel. Abriendo métricas generales...");
    await navigate("admin");
    return;
  }

  const agentId = agent?.id;
  if (!agentId) {
    container.innerHTML = emptyState("Tu usuario existe, pero todavía no tiene perfil de agente asignado.");
    return;
  }

  const [{ data: leads = [] }, { data: commissions = [] }, { data: reports = [] }] = await Promise.all([
    client.from("leads").select("*").eq("assigned_agent_id", agentId).order("updated_at", { ascending: false }),
    client.from("commissions").select("*").eq("agent_id", agentId),
    client.from("sales_reports").select("*").eq("agent_id", agentId).order("report_date", { ascending: false }).limit(5),
  ]);

  const today = new Date();
  const pending = leads.filter((lead) => lead.status !== "Ganado" && lead.status !== "Perdido").length;
  const overdue = leads.filter((lead) => lead.next_follow_up_at && new Date(lead.next_follow_up_at) < today && !["Ganado", "Perdido"].includes(lead.status)).length;
  const proposals = leads.filter((lead) => lead.status === "Propuesta enviada").length;
  const won = leads.filter((lead) => lead.status === "Ganado" && lead.payment_confirmed).length;
  const estimatedCommission = commissions
    .filter((commission) => commission.status !== "anulada")
    .reduce((sum, commission) => sum + Number(commission.commission_amount || 0), 0);

  container.innerHTML = `
    <section class="grid four">
      ${metric("Leads asignados", leads.length)}
      ${metric("Contactos pendientes", pending)}
      ${metric("Seguimientos vencidos", overdue)}
      ${metric("Comisiones estimadas", money(estimatedCommission))}
    </section>

    <section class="grid two">
      <article class="card">
        <h2>Actividad comercial</h2>
        <div class="grid two">
          ${metric("Propuestas enviadas", proposals)}
          ${metric("Ventas cerradas y pagadas", won)}
        </div>
      </article>
      <article class="card">
        <h2>Accesos rápidos</h2>
        <div class="actions">
          ${quickLinks.map(([route, label]) => `<button class="button" data-quick-route="${route}" type="button">${label}</button>`).join("")}
        </div>
      </article>
    </section>

    <section class="grid two">
      <article class="card">
        <h2>Próximos seguimientos</h2>
        ${renderUpcoming(leads)}
      </article>
      <article class="card">
        <h2>Perfil del agente</h2>
        ${renderAgentProfile(agent, state.profile)}
      </article>
    </section>

    <section class="card">
      <h2>Últimos reportes</h2>
      ${reports.length ? renderReportList(reports) : emptyState("Todavía no has registrado reportes.")}
    </section>
  `;

  container.querySelectorAll("[data-quick-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.quickRoute));
  });
}

function metric(label, value) {
  return `<article class="card metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function renderUpcoming(leads) {
  const items = leads
    .filter((lead) => lead.next_follow_up_at && !["Ganado", "Perdido"].includes(lead.status))
    .sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at))
    .slice(0, 6);

  if (!items.length) return emptyState("Sin seguimientos pendientes.");
  return `<ul class="list">${items
    .map(
      (lead) => `
        <li>
          <strong>${escapeHtml(lead.business_name)}</strong><br />
          <span class="muted">${escapeHtml(lead.next_action || "Seguimiento")} · ${niceDate(lead.next_follow_up_at)}</span><br />
          ${leadBadge(lead.status)}
        </li>`,
    )
    .join("")}</ul>`;
}

function renderAgentProfile(agent, profile) {
  const sensitive = agent.internal_notes ? `<p class="muted">Las notas internas sensibles solo son visibles para admin.</p>` : "";
  return `
    <div class="grid two">
      <p><strong>Nombre</strong><br />${escapeHtml(profile?.full_name || "Pendiente")}</p>
      <p><strong>País</strong><br />${escapeHtml(agent.country || "Pendiente")}</p>
      <p><strong>WhatsApp</strong><br />${escapeHtml(agent.whatsapp || agent.phone || "Pendiente")}</p>
      <p><strong>Disponibilidad</strong><br />${escapeHtml(agent.availability || "Pendiente")}</p>
      <p><strong>Estado</strong><br /><span class="badge">${escapeHtml(agent.status || "capacitación")}</span></p>
      <p><strong>Modalidad</strong><br />${escapeHtml(agent.compensation_mode || "comisión")}</p>
      <p><strong>Fecha de ingreso</strong><br />${niceDate(agent.start_date)}</p>
      <p><strong>Comisión</strong><br />${Number(agent.commission_rate || 0) * 100}%</p>
    </div>
    ${sensitive}
  `;
}

function renderReportList(reports) {
  return `<ul class="list">${reports
    .map(
      (report) => `
      <li>
        <strong>${niceDate(report.report_date)}</strong>
        <p class="muted">Contactos: ${report.new_contacts || 0} · Respuestas: ${report.responses_received || 0} · Propuestas: ${
          report.proposals_sent || 0
        } · Ventas: ${report.sales_closed || 0}</p>
      </li>`,
    )
    .join("")}</ul>`;
}

export async function renderSalesProcess(container) {
  const steps = [
    "Buscar prospectos",
    "Registrar prospecto",
    "Enviar primer mensaje personalizado",
    "Calificar necesidad",
    "Presentar servicio o plan cuando haya interés",
    "Agendar llamada o pasar a cierre técnico",
    "Enviar propuesta",
    "Dar seguimiento",
    "Marcar venta ganada solo con pago o anticipo confirmado",
  ];

  const neverPromise = [
    "Precios por debajo de lo autorizado",
    "Descuentos sin aprobación",
    "Fechas exactas sin confirmación técnica",
    "Funciones fuera de alcance",
    "Ventas garantizadas",
    "Primera posición en Google",
    "Tráfico garantizado",
  ];

  const escalate = [
    "SaaS",
    "Apps",
    "Software a medida",
    "Roles y permisos",
    "Paneles administrativos",
    "Integraciones críticas",
  ];

  container.innerHTML = `
    <section class="grid two">
      <article class="card">
        <h2>Proceso comercial</h2>
        <ul class="list">${steps.map((step, index) => `<li><strong>${index + 1}.</strong> ${escapeHtml(step)}</li>`).join("")}</ul>
      </article>
      <article class="card">
        <h2>Checklist para pasar a cierre</h2>
        <ul class="list">
          <li>Necesidad y problema principal claros.</li>
          <li>Servicio solicitado y plan recomendado documentados.</li>
          <li>Presupuesto aproximado validado.</li>
          <li>Cliente entiende que precio y alcance final requieren confirmación.</li>
          <li>Pago o anticipo confirmado antes de marcar como ganado.</li>
        </ul>
      </article>
    </section>
    <section class="grid two">
      <article class="card">
        <h2>Nunca prometer</h2>
        <ul class="list">${neverPromise.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
      <article class="card">
        <h2>Requieren revisión técnica</h2>
        <ul class="list">${escalate.map((item) => `<li>${escapeHtml(item)} debe escalarse a Maikel.</li>`).join("")}</ul>
      </article>
    </section>
  `;
}

export async function renderPrices(container, state) {
  const base = [
    ["Landing page", "desde $150"],
    ["Sitio web corporativo", "desde $500"],
    ["E-commerce / tienda online", "desde $700"],
    ["Dashboards y plataformas SaaS", "desde $1,200"],
    ["PWA", "desde $1,000"],
    ["Mantenimiento y optimización", "desde $100 / mes"],
  ];
  const plans = [
    ["Plan Esencial", "desde $500"],
    ["Plan Profesional", "desde $800"],
    ["Plan Tienda en línea", "desde $1,500"],
  ];

  container.innerHTML = `
    ${state.isAdmin ? `<section class="system-message">Validar precios oficiales antes de publicación comercial final.</section>` : ""}
    <section class="grid two">
      <article class="card">
        <h2>Servicios base</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Servicio</th><th>Precio referencial</th></tr></thead>
            <tbody>${base.map(([name, price]) => `<tr><td>${escapeHtml(name)}</td><td><strong>${escapeHtml(price)}</strong></td></tr>`).join("")}</tbody>
          </table>
        </div>
      </article>
      <article class="card">
        <h2>Planes comerciales</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Plan</th><th>Precio referencial</th></tr></thead>
            <tbody>${plans.map(([name, price]) => `<tr><td>${escapeHtml(name)}</td><td><strong>${escapeHtml(price)}</strong></td></tr>`).join("")}</tbody>
          </table>
        </div>
        <p class="muted">Los agentes deben comunicar precios como referenciales y siempre usando “desde”.</p>
      </article>
    </section>
  `;
}
