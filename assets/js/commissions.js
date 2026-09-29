import { commissionBadge, emptyState, escapeHtml, money, niceDate } from "./utils.js";

export async function renderCommissions(container, state) {
  const { data: commissions = [], error } = await state.client
    .from("commissions")
    .select(
      "*, leads!commissions_lead_id_fkey(business_name, agreed_amount, final_sale_amount, price_adjustment_note, payment_status), agents!commissions_agent_id_fkey(id, profiles!agents_user_id_fkey(full_name,email))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const receivable = commissions.filter((commission) => ["estimada", "aprobada"].includes(commission.status));
  const generated = commissions.filter((commission) => commission.status !== "anulada");
  const paid = commissions.filter((commission) => commission.status === "pagada");

  container.innerHTML = `
    <section class="grid three">
      ${metric("Comisiones por cobrar", money(sumCommissions(receivable)))}
      ${metric("Comisiones generadas", money(sumCommissions(generated)))}
      ${metric("Pagos recibidos", money(sumCommissions(paid)))}
    </section>

    <section class="card">
      <h2>Flujo de comisión</h2>
      <ul class="list">
        <li>El agente registra y trabaja el lead.</li>
        <li>El lead entra a reunión y se define un monto acordado.</li>
        <li>Solo admin marca el sub tag <strong>pagado</strong>, registra monto final y aprueba el pago.</li>
        <li>La comisión se genera automáticamente sobre el monto final pagado.</li>
        <li>Cuando admin confirma que ya pagó al agente, pasa al log de pagos recibidos.</li>
      </ul>
    </section>

    <section class="card">
      <h2>Por cobrar</h2>
      ${renderCommissionTable(receivable, state, true)}
    </section>

    <section class="card">
      <h2>Log de pagos recibidos</h2>
      ${renderCommissionTable(paid, state, false)}
    </section>
  `;

  container.querySelectorAll("[data-mark-commission-paid]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { error: updateError } = await state.client
        .from("commissions")
        .update({ status: "pagada", paid_at: new Date().toISOString().slice(0, 10), paid_by: state.user.id })
        .eq("id", button.dataset.markCommissionPaid);
      if (updateError) throw updateError;
      await renderCommissions(container, state);
    });
  });
}

function metric(label, value) {
  return `<article class="card metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function sumCommissions(commissions) {
  return commissions.reduce((sum, commission) => sum + Number(commission.commission_amount || 0), 0);
}

function renderCommissionTable(commissions, state, canPay) {
  if (!commissions.length) return emptyState("No hay comisiones en esta sección.");
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Agente</th>
            <th>Monto acordado</th>
            <th>Monto final</th>
            <th>Comisión</th>
            <th>Estado</th>
            <th>Notas</th>
            ${state.isAdmin && canPay ? "<th>Acción</th>" : ""}
          </tr>
        </thead>
        <tbody>${commissions
          .map(
            (item) => `
          <tr>
            <td>${escapeHtml(item.leads?.business_name || "Lead")}<br /><span class="badge success">${escapeHtml(
              item.leads?.payment_status || "pagado",
            )}</span></td>
            <td>${escapeHtml(item.agents?.profiles?.full_name || "Agente")}</td>
            <td>${money(item.agreed_amount || item.leads?.agreed_amount || item.sale_amount)}</td>
            <td>${money(item.sale_amount || item.leads?.final_sale_amount)}</td>
            <td>${money(item.commission_amount)}<br /><span class="muted">${Number(item.commission_rate || 0) * 100}%</span></td>
            <td>${commissionBadge(item.status)}<br /><span class="muted">Aprobada: ${niceDate(item.approved_at || item.closed_at)}</span><br /><span class="muted">Pagada: ${niceDate(
              item.paid_at,
            )}</span></td>
            <td>${escapeHtml(item.notes || item.leads?.price_adjustment_note || "")}</td>
            ${
              state.isAdmin && canPay
                ? `<td><button class="button primary" data-mark-commission-paid="${item.id}" type="button">Marcar pagada</button></td>`
                : ""
            }
          </tr>`,
          )
          .join("")}</tbody>
      </table>
    </div>`;
}
