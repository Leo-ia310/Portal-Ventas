import {
  dateTimeValue,
  emptyState,
  escapeHtml,
  leadBadge,
  LEAD_STATUSES,
  money,
  niceDate,
  optionList,
  serializeForm,
  showMessage,
} from "./utils.js";

let cache = {
  leads: [],
  agents: [],
  editing: null,
};

const BOARD_COLUMNS = ["Nuevo", "Contactado", "Interesado", "Llamada agendada", "Propuesta enviada", "Negociación", "Ganado", "Perdido"];

export async function renderLeads(container, state) {
  cache.editing = null;
  await loadData(state);
  paint(container, state);
}

async function loadData(state) {
  const [{ data: leads = [], error: leadError }, { data: agents = [], error: agentError }] = await Promise.all([
    state.client
      .from("leads")
      .select("*, agents!leads_assigned_agent_id_fkey(id, commission_rate, profiles!agents_user_id_fkey(full_name,email))")
      .order("updated_at", { ascending: false }),
    state.client.from("agents").select("id, status, commission_rate, profiles!agents_user_id_fkey(full_name,email)").order("created_at", { ascending: false }),
  ]);
  if (leadError) throw leadError;
  if (agentError && state.isAdmin) throw agentError;
  cache.leads = leads;
  cache.agents = agents;
}

function paint(container, state) {
  container.innerHTML = `
    <section class="card">
      <div class="section-toolbar">
        <div>
          <h2>Tablero CRM</h2>
          <p class="muted">Filtra, revisa y avanza leads sin abrir formularios hasta que sea necesario.</p>
        </div>
        <button class="button primary" id="open-lead-modal" type="button">Crear lead</button>
      </div>
    </section>

    <section class="card">
      <form id="lead-filters" class="filters">
        <label class="wide">Buscar
          <input name="search" placeholder="Negocio, contacto o WhatsApp" />
        </label>
        <label>Estado
          <select name="status">
            <option value="">Todos</option>
            ${optionList(LEAD_STATUSES)}
          </select>
        </label>
        <label>Canal
          <input name="source_channel" placeholder="Instagram, referido..." />
        </label>
        ${
          state.isAdmin
            ? `<label>Agente
                <select name="agent_id">
                  <option value="">Todos</option>
                  ${agentOptions()}
                </select>
              </label>`
            : ""
        }
        <label>Desde
          <input name="from" type="date" />
        </label>
      </form>
    </section>

    <section id="lead-board">${renderLeadBoard(cache.leads, state)}</section>
  `;

  container.querySelector("#open-lead-modal").addEventListener("click", () => {
    cache.editing = null;
    openLeadModal(container, state);
  });

  container.querySelector("#lead-filters").addEventListener("input", (event) => {
    const values = serializeForm(event.currentTarget);
    container.querySelector("#lead-board").innerHTML = renderLeadBoard(filterLeads(values), state);
    bindBoardEvents(container, state);
  });

  bindBoardEvents(container, state);
}

function openLeadModal(container, state) {
  const lead = cache.editing || {};
  const modal = document.createElement("section");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-panel">
      <div class="modal-header">
        <h2>${cache.editing ? "Editar lead" : "Crear lead"}</h2>
        <button class="button ghost" data-close-modal type="button">Cerrar</button>
      </div>
      <form id="lead-form" class="form-grid">
        ${leadFormFields(state, lead)}
        <div class="full actions">
          <button class="button primary" type="submit">${cache.editing ? "Guardar cambios" : "Crear lead"}</button>
          <p id="lead-message" class="form-message"></p>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("[data-close-modal]").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });

  modal.querySelector("#lead-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = modal.querySelector("#lead-message");
    const payload = normalizeLeadPayload(serializeForm(event.currentTarget), state);

    if (payload.status === "Ganado" && !payload.payment_confirmed) {
      showMessage(message, "Solo admin puede marcar un lead como Ganado cuando el pago está aprobado.", "error");
      return;
    }

    try {
      const query = cache.editing
        ? state.client.from("leads").update(payload).eq("id", cache.editing.id).select().single()
        : state.client.from("leads").insert(payload).select().single();
      const { data: savedLead, error } = await query;
      if (error) throw error;
      if (state.isAdmin) await ensureCommissionForPaidLead(state, savedLead);
      showMessage(message, cache.editing ? "Lead actualizado." : "Lead creado.", "success");
      modal.remove();
      cache.editing = null;
      await loadData(state);
      paint(container, state);
    } catch (error) {
      showMessage(message, error.message || "No se pudo guardar el lead.", "error");
    }
  });
}

function leadFormFields(state, lead = {}) {
  lead = lead || {};
  const selectedAgent = lead.assigned_agent_id || state.agent?.id || "";
  const statuses = state.isAdmin ? LEAD_STATUSES : LEAD_STATUSES.filter((status) => status !== "Ganado");
  return `
    <label>Nombre del negocio
      <input name="business_name" required value="${escapeHtml(lead.business_name || "")}" />
    </label>
    <label>Persona de contacto
      <input name="contact_name" value="${escapeHtml(lead.contact_name || "")}" />
    </label>
    <label>País
      <input name="country" value="${escapeHtml(lead.country || "")}" />
    </label>
    <label>Ciudad
      <input name="city" value="${escapeHtml(lead.city || "")}" />
    </label>
    <label>Canal de origen
      <input name="source_channel" value="${escapeHtml(lead.source_channel || "")}" />
    </label>
    <label>WhatsApp
      <input name="whatsapp" value="${escapeHtml(lead.whatsapp || "")}" />
    </label>
    <label>Correo
      <input name="email" type="email" value="${escapeHtml(lead.email || "")}" />
    </label>
    <label>Red social
      <input name="social_url" type="url" value="${escapeHtml(lead.social_url || "")}" />
    </label>
    <label>Servicio solicitado
      <input name="requested_service" value="${escapeHtml(lead.requested_service || "")}" />
    </label>
    <label>Presupuesto aproximado
      <input name="estimated_budget" value="${escapeHtml(lead.estimated_budget || "")}" />
    </label>
    <label>Plan recomendado
      <input name="recommended_plan" value="${escapeHtml(lead.recommended_plan || "")}" />
    </label>
    <label>Estado
      <select name="status">${optionList(statuses, lead.status || "Nuevo")}</select>
    </label>
    <label>Fecha de reunión
      <input name="meeting_at" type="datetime-local" value="${dateTimeValue(lead.meeting_at)}" />
    </label>
    <label>Próxima acción
      <input name="next_action" value="${escapeHtml(lead.next_action || "")}" />
    </label>
    <label>Próximo seguimiento
      <input name="next_follow_up_at" type="datetime-local" value="${dateTimeValue(lead.next_follow_up_at)}" />
    </label>
    <label>Último contacto
      <input name="last_contact_at" type="datetime-local" value="${dateTimeValue(lead.last_contact_at)}" />
    </label>
    ${
      state.isAdmin
        ? `<label>Agente responsable
            <select name="assigned_agent_id">
              <option value="">Sin asignar</option>
              ${agentOptions(selectedAgent)}
            </select>
          </label>
          <label>Sub tag de pago
            <select name="payment_status">
              <option value="pendiente" ${lead.payment_status === "pendiente" || !lead.payment_status ? "selected" : ""}>Pendiente</option>
              <option value="pagado" ${lead.payment_status === "pagado" ? "selected" : ""}>Pagado</option>
              <option value="parcial" ${lead.payment_status === "parcial" ? "selected" : ""}>Pago parcial</option>
              <option value="reembolsado" ${lead.payment_status === "reembolsado" ? "selected" : ""}>Reembolsado</option>
            </select>
          </label>
          <label>Monto acordado en reunión
            <input name="agreed_amount" type="number" min="0" step="0.01" value="${escapeHtml(lead.agreed_amount || "")}" />
          </label>
          <label>Monto final pagado
            <input name="final_sale_amount" type="number" min="0" step="0.01" value="${escapeHtml(lead.final_sale_amount || "")}" />
          </label>
          <label class="wide">Cambio de monto / explicación
            <textarea name="price_adjustment_note">${escapeHtml(lead.price_adjustment_note || "")}</textarea>
          </label>`
        : `<input name="assigned_agent_id" type="hidden" value="${escapeHtml(selectedAgent)}" />`
    }
    <label class="wide">Problema principal
      <textarea name="main_problem">${escapeHtml(lead.main_problem || "")}</textarea>
    </label>
    <label class="wide">Notas
      <textarea name="notes">${escapeHtml(lead.notes || "")}</textarea>
    </label>
    <label class="wide">Razón de pérdida
      <textarea name="lost_reason">${escapeHtml(lead.lost_reason || "")}</textarea>
    </label>
  `;
}

function agentOptions(selected = "") {
  return cache.agents
    .map((agent) => {
      const label = agent.profiles?.full_name || agent.profiles?.email || agent.id;
      return `<option value="${agent.id}" ${agent.id === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function bindBoardEvents(container, state) {
  container.querySelectorAll("[data-edit-lead]").forEach((button) => {
    button.addEventListener("click", () => {
      cache.editing = cache.leads.find((lead) => lead.id === button.dataset.editLead);
      openLeadModal(container, state);
    });
  });

  container.querySelectorAll("[data-delete-lead]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.isAdmin) return;
      const { error } = await state.client.from("leads").delete().eq("id", button.dataset.deleteLead);
      if (error) throw error;
      await loadData(state);
      paint(container, state);
    });
  });

  container.querySelectorAll("[data-activity-lead]").forEach((button) => {
    button.addEventListener("click", () => openActivityModal(container, state, button.dataset.activityLead));
  });
}

function normalizeLeadPayload(values, state) {
  const isPaid = state.isAdmin && values.payment_status === "pagado" && Number(values.final_sale_amount || 0) > 0;
  const payload = {
    business_name: values.business_name,
    contact_name: values.contact_name,
    country: values.country,
    city: values.city,
    source_channel: values.source_channel,
    whatsapp: values.whatsapp,
    email: values.email,
    social_url: values.social_url,
    requested_service: values.requested_service,
    main_problem: values.main_problem,
    estimated_budget: values.estimated_budget,
    recommended_plan: values.recommended_plan,
    status: isPaid ? "Ganado" : values.status || "Nuevo",
    next_action: values.next_action,
    next_follow_up_at: values.next_follow_up_at || null,
    last_contact_at: values.last_contact_at || null,
    meeting_at: values.meeting_at || null,
    assigned_agent_id: values.assigned_agent_id || state.agent?.id || null,
    created_by: state.user.id,
    notes: values.notes,
    payment_confirmed: isPaid,
    won_at: isPaid ? cache.editing?.won_at || new Date().toISOString() : null,
    lost_reason: values.lost_reason,
  };

  if (state.isAdmin) {
    payload.payment_status = values.payment_status || "pendiente";
    payload.agreed_amount = values.agreed_amount ? Number(values.agreed_amount) : null;
    payload.final_sale_amount = values.final_sale_amount ? Number(values.final_sale_amount) : null;
    payload.price_adjustment_note = values.price_adjustment_note || null;
    payload.payment_approved_at = isPaid ? cache.editing?.payment_approved_at || new Date().toISOString() : null;
    payload.payment_approved_by = isPaid ? state.user.id : null;
  }

  if (cache.editing) delete payload.created_by;
  return payload;
}

async function ensureCommissionForPaidLead(state, lead) {
  if (!lead.payment_confirmed || lead.payment_status !== "pagado" || !lead.assigned_agent_id || !lead.final_sale_amount) return;

  const agent = cache.agents.find((item) => item.id === lead.assigned_agent_id) || lead.agents;
  const commissionRate = Number(agent?.commission_rate || 0.3);
  const saleAmount = Number(lead.final_sale_amount || 0);
  const payload = {
    lead_id: lead.id,
    agent_id: lead.assigned_agent_id,
    sale_amount: saleAmount,
    agreed_amount: lead.agreed_amount ? Number(lead.agreed_amount) : saleAmount,
    commission_rate: commissionRate,
    commission_amount: saleAmount * commissionRate,
    status: "aprobada",
    closed_at: new Date().toISOString().slice(0, 10),
    approved_at: new Date().toISOString(),
    notes: lead.price_adjustment_note || "Generada automáticamente al aprobar pago del lead.",
  };

  const { data: existing } = await state.client.from("commissions").select("id, status, paid_at").eq("lead_id", lead.id).maybeSingle();
  const query = existing
    ? state.client.from("commissions").update({ ...payload, status: existing.status === "pagada" ? "pagada" : "aprobada", paid_at: existing.paid_at }).eq("id", existing.id)
    : state.client.from("commissions").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

function filterLeads(values) {
  const term = values.search?.trim().toLowerCase();
  return cache.leads.filter((lead) => {
    const haystack = `${lead.business_name || ""} ${lead.contact_name || ""} ${lead.whatsapp || ""}`.toLowerCase();
    const matchesTerm = !term || haystack.includes(term);
    const matchesStatus = !values.status || lead.status === values.status;
    const matchesChannel = !values.source_channel || (lead.source_channel || "").toLowerCase().includes(values.source_channel.toLowerCase());
    const matchesAgent = !values.agent_id || lead.assigned_agent_id === values.agent_id;
    const matchesDate = !values.from || new Date(lead.created_at) >= new Date(values.from);
    return matchesTerm && matchesStatus && matchesChannel && matchesAgent && matchesDate;
  });
}

function renderLeadBoard(leads, state) {
  if (!leads.length) return emptyState("No hay leads con estos criterios.");
  const extraStatuses = leads.map((lead) => lead.status).filter((status) => status && !BOARD_COLUMNS.includes(status));
  const columns = [...BOARD_COLUMNS, ...new Set(extraStatuses)];
  return `
    <div class="crm-board">
      ${columns
        .map((status) => {
          const items = leads.filter((lead) => lead.status === status);
          return `
            <article class="crm-column">
              <div class="crm-column-header">
                <strong>${escapeHtml(status)}</strong>
                <span class="badge">${items.length}</span>
              </div>
              ${items.length ? items.map((lead) => renderLeadCard(lead, state)).join("") : `<p class="muted">Sin leads.</p>`}
            </article>`;
        })
        .join("")}
    </div>
  `;
}

function renderLeadCard(lead, state) {
  const amountText = lead.final_sale_amount ? money(lead.final_sale_amount) : lead.agreed_amount ? `${money(lead.agreed_amount)} acordado` : "";
  return `
    <article class="lead-card">
      <div class="copy-row">
        <div>
          <h3>${escapeHtml(lead.business_name)}</h3>
          <p>${escapeHtml(lead.contact_name || "Sin contacto")} · ${escapeHtml(lead.whatsapp || lead.email || "Sin contacto directo")}</p>
        </div>
        ${leadBadge(lead.status)}
      </div>
      <p>${escapeHtml(lead.requested_service || "Servicio por definir")}</p>
      <p>Reunión: ${niceDate(lead.meeting_at)}</p>
      <p>Seguimiento: ${niceDate(lead.next_follow_up_at)}</p>
      ${lead.payment_status ? `<span class="badge ${lead.payment_status === "pagado" ? "success" : "warning"}">${escapeHtml(lead.payment_status)}</span>` : ""}
      ${amountText ? `<p><strong>${escapeHtml(amountText)}</strong></p>` : ""}
      <div class="actions">
        <button class="button" data-edit-lead="${lead.id}" type="button">Editar</button>
        <button class="button" data-activity-lead="${lead.id}" type="button">Actividad</button>
        ${state.isAdmin ? `<button class="button danger" data-delete-lead="${lead.id}" type="button">Eliminar</button>` : ""}
      </div>
    </article>
  `;
}

function openActivityModal(container, state, leadId) {
  const lead = cache.leads.find((item) => item.id === leadId);
  const modal = document.createElement("section");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-panel">
      <div class="modal-header">
        <h2>Registrar actividad: ${escapeHtml(lead?.business_name || "")}</h2>
        <button class="button ghost" data-close-modal type="button">Cerrar</button>
      </div>
      <form id="activity-form" class="form-grid">
        <label>Tipo
          <select name="type">
            <option>contacto</option>
            <option>seguimiento</option>
            <option>reunión</option>
            <option>propuesta</option>
            <option>pago</option>
            <option>nota</option>
          </select>
        </label>
        <label class="wide">Notas
          <textarea name="notes" required></textarea>
        </label>
        <div class="full actions">
          <button class="button primary" type="submit">Guardar actividad</button>
          <p id="activity-message" class="form-message"></p>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("[data-close-modal]").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });

  modal.querySelector("#activity-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = serializeForm(event.currentTarget);
    const payload = {
      lead_id: leadId,
      agent_id: lead?.assigned_agent_id || state.agent?.id,
      type: values.type,
      notes: values.notes,
    };
    const { error } = await state.client.from("lead_activities").insert(payload);
    if (error) {
      showMessage(modal.querySelector("#activity-message"), error.message, "error");
      return;
    }
    modal.remove();
    await loadData(state);
    paint(container, state);
  });
}
