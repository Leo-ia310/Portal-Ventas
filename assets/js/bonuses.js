import { emptyState, escapeHtml, money } from "./utils.js";

const SALES_THRESHOLD = 1500;
const STRONG_SALE_AMOUNT = 400;
const STRONG_SALE_COUNT = 4;
const BONUS_AMOUNT = 100;

export async function renderBonuses(container, state) {
  const { data: commissions = [], error } = await state.client
    .from("commissions")
    .select("*, agents!commissions_agent_id_fkey(id, profiles!agents_user_id_fkey(full_name,email))")
    .neq("status", "anulada")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = state.isAdmin ? groupByAgent(commissions) : groupByAgent(commissions.filter((commission) => commission.agent_id === state.agent?.id));

  container.innerHTML = `
    <section class="card">
      <h2>Reglas de bonos</h2>
      <ul class="list">
        <li>Por cada tramo de ${money(SALES_THRESHOLD)} en ventas pagadas, se sugiere bono de ${money(BONUS_AMOUNT)}.</li>
        <li>También aplica si acumula ${STRONG_SALE_COUNT} ventas fuertes. Una venta fuerte se calcula desde ${money(STRONG_SALE_AMOUNT)}.</li>
        <li>Si acumula más tramos, el bono sugerido aumenta en bloques de ${money(BONUS_AMOUNT)}.</li>
        <li>El pago final del bono queda sujeto a confirmación administrativa.</li>
      </ul>
    </section>

    <section class="card">
      <h2>${state.isAdmin ? "Bonos por agente" : "Mis bonos"}</h2>
      ${renderBonusTable(rows)}
    </section>
  `;
}

function groupByAgent(commissions) {
  const grouped = new Map();
  commissions.forEach((commission) => {
    const key = commission.agent_id || "sin-agente";
    const current =
      grouped.get(key) ||
      {
        agent: commission.agents?.profiles?.full_name || "Agente",
        sales: 0,
        strongSales: 0,
        generatedCommission: 0,
      };
    current.sales += Number(commission.sale_amount || 0);
    current.generatedCommission += Number(commission.commission_amount || 0);
    if (Number(commission.sale_amount || 0) >= STRONG_SALE_AMOUNT) current.strongSales += 1;
    grouped.set(key, current);
  });
  return [...grouped.values()].map((row) => {
    const salesTiers = Math.floor(row.sales / SALES_THRESHOLD);
    const strongSaleTiers = Math.floor(row.strongSales / STRONG_SALE_COUNT);
    const approvedTiers = Math.max(salesTiers, strongSaleTiers);
    return {
      ...row,
      salesTiers,
      strongSaleTiers,
      bonus: approvedTiers * BONUS_AMOUNT,
    };
  });
}

function renderBonusTable(rows) {
  if (!rows.length) return emptyState("Todavía no hay ventas pagadas para calcular bonos.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Agente</th><th>Ventas pagadas</th><th>Ventas fuertes</th><th>Tramos</th><th>Bono sugerido</th><th>Comisión generada</th></tr></thead>
        <tbody>${rows
          .map(
            (row) => `
          <tr>
            <td>${escapeHtml(row.agent)}</td>
            <td>${money(row.sales)}</td>
            <td>${row.strongSales}</td>
            <td>Volumen: ${row.salesTiers}<br />Fuertes: ${row.strongSaleTiers}</td>
            <td><strong>${money(row.bonus)}</strong></td>
            <td>${money(row.generatedCommission)}</td>
          </tr>`,
          )
          .join("")}</tbody>
      </table>
    </div>
  `;
}
