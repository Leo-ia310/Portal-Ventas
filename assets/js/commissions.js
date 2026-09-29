import { commissionBadge, COMMISSION_STATUSES, emptyState, escapeHtml, money, niceDate, optionList, serializeForm, showMessage } from "./utils.js";

export async function renderCommissions(container, state) {
  const [{ data: commissions = [] }, { data: leads = [] }, { data: agents = [] }] = await Promise.all([
    state.client
      .from("commissions")
      .select("*, leads!commissions_lead_id_fkey(business_name), agents!commissions_agent_id_fkey(id, profiles!agents_user_id_fkey(full_name,email))")
      .order("created_at", { ascending: false }),
    state.client.from("leads").select("id, business_name, assigned_agent_id, payment_confirmed, status").order("business_name"),
    state.client.from("agents").select("id, commission_rate, profiles!agents_user_id_fkey(full_name,email)").order("created_at"),
  ]);

  container.innerHTML = `
    ${
      state.isAdmin
        ? `<section class="form-panel">
            <h2>Registrar comisión</h2>
            <form id="commission-form" class="form-grid">
              <label>Lead
                <select name="lead_id" required>${leads.map((lead) => `<option value="${lead.id}">${escapeHtml(lead.business_name)}</option>`).join("")}</select>
              </label>
              <label>Agente
                <select name="agent_id" required>${agents
                  .map((agent) => `<option value="${agent.id}" data-rate="${agent.commission_rate || 0.3}">${escapeHtml(agent.profiles?.full_name || agent.id)}</option>`)
                  .join("")}</select>
              </label>
              <label>Monto de venta
                <input name="sale_amount" type="number" step="0.01" min="0" required />
              </label>
              <label>Porcentaje
                <input name="commission_rate" type="number" step="0.01" min="0" max="1" value="0.30" required />
              </label>
              <label>Monto comisión
                <input name="commission_amount" type="number" step="0.01" min="0" readonly />
              </label>
              <label>Estado
                <select name="status">${optionList(COMMISSION_STATUSES, "estimada")}</select>
              </label>
              <label>Fecha de cierre
                <input name="closed_at" type="date" />
              </label>
              <label>Fecha de pago
                <input name="paid_at" type="date" />
              </label>
              <label class="wide">Notas
                <textarea name="notes"></textarea>
              </label>
              <div class="full actions">
                <button class="button primary" type="submit">Guardar comisión</button>
                <p id="commission-message" class="form-message"></p>
              </div>
            </form>
          </section>`
        : ""
    }

    <section class="card">
      <h2>Reglas de comisión</h2>
      <ul class="list">
        <li>La comisión se calcula sobre ventas cerradas y pagadas.</li>
        <li>Una conversación o lead interesado no genera comisión.</li>
        <li>Si el cliente no paga, no se genera comisión.</li>
        <li>Si hay reembolso total, la comisión no aplica; si es parcial, puede ajustarse proporcionalmente.</li>
        <li>Cualquier base, bono o cambio debe quedar por escrito.</li>
        <li>Sergio inicia con 30% por venta cerrada y pagada. La base de $200 + 20% es posibilidad futura, no promesa.</li>
      </ul>
    </section>

    <section class="card">
      <h2>Comisiones</h2>
      ${renderCommissionTable(commissions)}
    </section>
  `;

  const form = container.querySelector("#commission-form");
  if (form) bindCommissionForm(form, state, container);
}

function bindCommissionForm(form, state, container) {
  const sale = form.elements.sale_amount;
  const rate = form.elements.commission_rate;
  const amount = form.elements.commission_amount;
  const message = form.querySelector("#commission-message");
  const updateAmount = () => {
    amount.value = (Number(sale.value || 0) * Number(rate.value || 0)).toFixed(2);
  };
  sale.addEventListener("input", updateAmount);
  rate.addEventListener("input", updateAmount);
  form.elements.agent_id.addEventListener("change", () => {
    const selected = form.elements.agent_id.selectedOptions[0];
    rate.value = selected.dataset.rate || "0.30";
    updateAmount();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = serializeForm(form);
    const payload = {
      ...values,
      sale_amount: Number(values.sale_amount),
      commission_rate: Number(values.commission_rate),
      commission_amount: Number(values.commission_amount),
      closed_at: values.closed_at || null,
      paid_at: values.paid_at || null,
    };
    const { error } = await state.client.from("commissions").insert(payload);
    if (error) {
      showMessage(message, error.message, "error");
      return;
    }
    showMessage(message, "Comisión registrada.", "success");
    await renderCommissions(container, state);
  });
}

function renderCommissionTable(commissions) {
  if (!commissions.length) return emptyState("No hay comisiones registradas.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Lead</th><th>Agente</th><th>Venta</th><th>Comisión</th><th>Estado</th><th>Fechas</th></tr></thead>
        <tbody>${commissions
          .map(
            (item) => `
          <tr>
            <td>${escapeHtml(item.leads?.business_name || "Lead")}</td>
            <td>${escapeHtml(item.agents?.profiles?.full_name || "Agente")}</td>
            <td>${money(item.sale_amount)}</td>
            <td>${money(item.commission_amount)}<br /><span class="muted">${Number(item.commission_rate || 0) * 100}%</span></td>
            <td>${commissionBadge(item.status)}</td>
            <td>Cierre: ${niceDate(item.closed_at)}<br />Pago: ${niceDate(item.paid_at)}</td>
          </tr>`,
          )
          .join("")}</tbody>
      </table>
    </div>`;
}
