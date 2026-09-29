import { emptyState, escapeHtml, niceDate, serializeForm, showMessage } from "./utils.js";

export async function renderReports(container, state) {
  const { data: reports = [], error } = await state.client
    .from("sales_reports")
    .select("*, agents!sales_reports_agent_id_fkey(id, profiles!agents_user_id_fkey(full_name,email))")
    .order("report_date", { ascending: false });
  if (error) throw error;

  container.innerHTML = `
    <section class="card">
      <div class="section-toolbar">
        <div>
          <h2>Reportes ${state.isAdmin ? "del equipo" : "propios"}</h2>
          <p class="muted">Revisa la actividad registrada antes de crear un reporte nuevo.</p>
        </div>
        ${state.agent ? `<button class="button primary" id="open-report-modal" type="button">Registrar reporte</button>` : ""}
      </div>
    </section>

    <section class="card">
      ${renderReportTable(reports, state)}
    </section>
  `;

  container.querySelector("#open-report-modal")?.addEventListener("click", () => {
    openReportModal(container, state);
  });
}

function openReportModal(container, state) {
  const modal = document.createElement("section");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-panel">
      <div class="modal-header">
        <h2>Registrar reporte</h2>
        <button class="button ghost" data-close-modal type="button">Cerrar</button>
      </div>
      <form id="report-form" class="form-grid">
        <label>Fecha <input name="report_date" type="date" required value="${new Date().toISOString().slice(0, 10)}" /></label>
        <label>Contactos nuevos <input name="new_contacts" type="number" min="0" value="0" /></label>
        <label>Respuestas recibidas <input name="responses_received" type="number" min="0" value="0" /></label>
        <label>Seguimientos enviados <input name="followups_sent" type="number" min="0" value="0" /></label>
        <label>Llamadas agendadas <input name="calls_scheduled" type="number" min="0" value="0" /></label>
        <label>Propuestas enviadas <input name="proposals_sent" type="number" min="0" value="0" /></label>
        <label>Ventas cerradas <input name="sales_closed" type="number" min="0" value="0" /></label>
        <label class="wide">Obstáculos o dudas <textarea name="blockers"></textarea></label>
        <label class="wide">Qué necesita del admin <textarea name="needs_from_admin"></textarea></label>
        <div class="full actions">
          <button class="button primary" type="submit">Guardar reporte</button>
          <p id="report-message" class="form-message"></p>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("[data-close-modal]").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });

  modal.querySelector("#report-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = modal.querySelector("#report-message");
    const values = serializeForm(event.currentTarget);
    const numericFields = ["new_contacts", "responses_received", "followups_sent", "calls_scheduled", "proposals_sent", "sales_closed"];
    const payload = { ...values, agent_id: state.agent.id };
    numericFields.forEach((field) => {
      payload[field] = Number(payload[field] || 0);
    });
    const { error: insertError } = await state.client.from("sales_reports").insert(payload);
    if (insertError) {
      showMessage(message, insertError.message, "error");
      return;
    }
    showMessage(message, "Reporte registrado.", "success");
    modal.remove();
    await renderReports(container, state);
  });
}

function renderReportTable(reports, state) {
  if (!reports.length) return emptyState("No hay reportes registrados.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Agente</th><th>Actividad</th><th>Bloqueos</th><th>Necesita</th></tr></thead>
        <tbody>${reports
          .map(
            (report) => `
          <tr>
            <td>${niceDate(report.report_date)}</td>
            <td>${state.isAdmin ? escapeHtml(report.agents?.profiles?.full_name || "Agente") : "Yo"}</td>
            <td>Contactos ${report.new_contacts || 0}<br />Respuestas ${report.responses_received || 0}<br />Seguimientos ${
              report.followups_sent || 0
            }<br />Llamadas ${report.calls_scheduled || 0}<br />Propuestas ${report.proposals_sent || 0}<br />Ventas ${
              report.sales_closed || 0
            }</td>
            <td>${escapeHtml(report.blockers || "")}</td>
            <td>${escapeHtml(report.needs_from_admin || "")}</td>
          </tr>`,
          )
          .join("")}</tbody>
      </table>
    </div>`;
}
