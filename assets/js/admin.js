import { emptyState, escapeHtml, money, niceDate, serializeForm, showMessage } from "./utils.js";

export async function renderAdmin(container, state) {
  if (!state.isAdmin) throw new Error("Solo Maikel/admin puede acceder a este panel.");

  const [{ data: agents = [] }, { data: leads = [] }, { data: reports = [] }, { data: commissions = [] }, { data: approvals = [] }] =
    await Promise.all([
      state.client.from("agents").select("*, profiles!agents_user_id_fkey(full_name,email)").order("created_at", { ascending: false }),
      state.client.from("leads").select("*, agents!leads_assigned_agent_id_fkey(id, profiles!agents_user_id_fkey(full_name,email))"),
      state.client
        .from("sales_reports")
        .select("*, agents!sales_reports_agent_id_fkey(id, profiles!agents_user_id_fkey(full_name,email))")
        .order("report_date", { ascending: false })
        .limit(20),
      state.client.from("commissions").select("*, agents!commissions_agent_id_fkey(id, profiles!agents_user_id_fkey(full_name,email))"),
      state.client.from("admin_approvals").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

  const totalCommission = commissions.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  const abandoned = leads.filter((lead) => lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date() && !["Ganado", "Perdido"].includes(lead.status));

  container.innerHTML = `
    <section class="grid four">
      ${metric("Agentes", agents.length)}
      ${metric("Leads nuevos", leads.filter((lead) => lead.status === "Nuevo").length)}
      ${metric("Ventas cerradas", leads.filter((lead) => lead.status === "Ganado" && lead.payment_confirmed).length)}
      ${metric("Comisión generada", money(totalCommission))}
    </section>

    <section class="grid two">
      <article class="form-panel">
        <h2>Crear / editar agente</h2>
        <form id="agent-form" class="form-grid">
          <label>Usuario
            <select name="user_id" required>
              <option value="">Seleccionar profile</option>
              ${await profileOptions(state)}
            </select>
          </label>
          <label>País <input name="country" /></label>
          <label>Teléfono <input name="phone" /></label>
          <label>WhatsApp <input name="whatsapp" /></label>
          <label>Disponibilidad <input name="availability" placeholder="Medio tiempo, full..." /></label>
          <label>Estado
            <select name="status">
              <option>capacitación</option>
              <option>prueba</option>
              <option>activo</option>
              <option>pausado</option>
              <option>desactivado</option>
            </select>
          </label>
          <label>Modalidad
            <select name="compensation_mode">
              <option>comisión</option>
              <option>base + comisión</option>
              <option>acuerdo especial</option>
            </select>
          </label>
          <label>Comisión
            <input name="commission_rate" type="number" min="0" max="1" step="0.01" value="0.30" />
          </label>
          <label>Base salarial
            <input name="base_salary" type="number" min="0" step="0.01" />
          </label>
          <label>Fecha de ingreso
            <input name="start_date" type="date" />
          </label>
          <label class="full">Notas internas
            <textarea name="internal_notes"></textarea>
          </label>
          <div class="full actions">
            <button class="button primary" type="submit">Guardar agente</button>
            <button class="button ghost" id="clear-agent-form" type="button">Limpiar</button>
            <p id="agent-message" class="form-message"></p>
          </div>
        </form>
      </article>
      <article class="card">
        <h2>Alertas</h2>
        <ul class="list">
          <li><strong>${abandoned.length}</strong> leads sin seguimiento o vencidos.</li>
          <li><strong>${reports.length ? "Actividad reciente" : "Sin reportes recientes"}</strong> en reportes.</li>
          <li><strong>${leads.filter((lead) => lead.status === "Negociación").length}</strong> ventas en negociación y cierre.</li>
        </ul>
      </article>
    </section>

    <section class="card">
      <h2>Agentes</h2>
      ${renderAgents(agents)}
    </section>

    <section class="grid two">
      <article class="card">
        <h2>Embudo completo</h2>
        ${renderFunnel(leads)}
      </article>
      <article class="card">
        <h2>Reportes recientes</h2>
        ${renderReports(reports)}
      </article>
    </section>

    <section class="card">
      <h2>Aprobaciones y excepciones</h2>
      ${approvals.length ? renderApprovals(approvals) : emptyState("Sin aprobaciones pendientes.")}
    </section>
  `;

  container.querySelector("#agent-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = container.querySelector("#agent-message");
    const values = serializeForm(event.currentTarget);
    const payload = {
      ...values,
      commission_rate: Number(values.commission_rate || 0),
      base_salary: values.base_salary ? Number(values.base_salary) : null,
      start_date: values.start_date || null,
    };
    const { error } = await state.client.from("agents").upsert(payload, { onConflict: "user_id" });
    if (error) {
      showMessage(message, error.message, "error");
      return;
    }
    showMessage(message, "Agente guardado.", "success");
    await renderAdmin(container, state);
  });

  container.querySelector("#clear-agent-form").addEventListener("click", () => {
    container.querySelector("#agent-form").reset();
  });

  container.querySelectorAll("[data-edit-agent]").forEach((button) => {
    button.addEventListener("click", () => {
      const agent = agents.find((item) => item.id === button.dataset.editAgent);
      const form = container.querySelector("#agent-form");
      Object.entries({
        user_id: agent.user_id,
        country: agent.country || "",
        phone: agent.phone || "",
        whatsapp: agent.whatsapp || "",
        availability: agent.availability || "",
        status: agent.status || "capacitación",
        compensation_mode: agent.compensation_mode || "comisión",
        commission_rate: agent.commission_rate || 0.3,
        base_salary: agent.base_salary || "",
        start_date: agent.start_date || "",
        internal_notes: agent.internal_notes || "",
      }).forEach(([key, value]) => {
        if (form.elements[key]) form.elements[key].value = value;
      });
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function profileOptions(state) {
  const { data: profiles = [] } = await state.client.from("profiles").select("id, full_name, email, role").order("created_at");
  return profiles
    .filter((profile) => profile.role === "agente")
    .map((profile) => `<option value="${profile.id}">${escapeHtml(profile.full_name || profile.email)}</option>`)
    .join("");
}

function metric(label, value) {
  return `<article class="card metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function renderAgents(agents) {
  if (!agents.length) return emptyState("Todavía no hay agentes configurados.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Agente</th><th>Estado</th><th>Modalidad</th><th>Comisión</th><th>Disponibilidad</th><th>Acciones</th></tr></thead>
        <tbody>${agents
          .map(
            (agent) => `
            <tr>
              <td><strong>${escapeHtml(agent.profiles?.full_name || "Sin nombre")}</strong><br /><span class="muted">${escapeHtml(
                agent.profiles?.email || "",
              )}</span></td>
              <td><span class="badge">${escapeHtml(agent.status || "capacitación")}</span></td>
              <td>${escapeHtml(agent.compensation_mode || "comisión")}</td>
              <td>${Number(agent.commission_rate || 0) * 100}%</td>
              <td>${escapeHtml(agent.availability || "")}</td>
              <td><button class="button" data-edit-agent="${agent.id}" type="button">Editar</button></td>
            </tr>`,
          )
          .join("")}</tbody>
      </table>
    </div>`;
}

function renderFunnel(leads) {
  const counts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});
  return `<ul class="list">${Object.entries(counts)
    .map(([status, count]) => `<li><strong>${escapeHtml(status)}</strong><br /><span class="muted">${count} leads</span></li>`)
    .join("")}</ul>`;
}

function renderReports(reports) {
  if (!reports.length) return emptyState("Sin reportes todavía.");
  return `<ul class="list">${reports
    .map(
      (report) => `
      <li>
        <strong>${escapeHtml(report.agents?.profiles?.full_name || "Agente")}</strong> · ${niceDate(report.report_date)}
        <p class="muted">Contactos ${report.new_contacts || 0}, respuestas ${report.responses_received || 0}, llamadas ${
          report.calls_scheduled || 0
        }, ventas ${report.sales_closed || 0}</p>
      </li>`,
    )
    .join("")}</ul>`;
}

function renderApprovals(approvals) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Tipo</th><th>Estado</th><th>Notas</th><th>Fecha</th></tr></thead>
    <tbody>${approvals
      .map(
        (approval) =>
          `<tr><td>${escapeHtml(approval.type)}</td><td><span class="badge">${escapeHtml(approval.status)}</span></td><td>${escapeHtml(
            approval.notes || "",
          )}</td><td>${niceDate(approval.created_at)}</td></tr>`,
      )
      .join("")}</tbody>
  </table></div>`;
}
