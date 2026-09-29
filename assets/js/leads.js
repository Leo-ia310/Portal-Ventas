import {
  dateTimeValue,
  emptyState,
  escapeHtml,
  leadBadge,
  LEAD_STATUSES,
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

export async function renderLeads(container, state) {
  cache.editing = null;
  await loadData(state);
  paint(container, state);
}

async function loadData(state) {
  const leadQuery = state.client
    .from("leads")
    .select("*, agents!leads_assigned_agent_id_fkey(id, profiles!agents_user_id_fkey(full_name,email))")
    .order("updated_at", { ascending: false });

  const [{ data: leads = [], error: leadError }, { data: agents = [], error: agentError }] = await Promise.all([
    leadQuery,
    state.client.from("agents").select("id, status, commission_rate, profiles!agents_user_id_fkey(full_name,email)").order("created_at", { ascending: false }),
  ]);
  if (leadError) throw leadError;
  if (agentError && state.isAdmin) throw agentError;
  cache.leads = leads;
  cache.agents = agents;
}

function paint(container, state) {
  container.innerHTML = `
    <section class="form-panel">
      <h2>${cache.editing ? "Editar lead" : "Crear lead"}</h2>
      <form id="lead-form" class="form-grid">
        ${leadFormFields(state, cache.editing || {})}
        <div class="full actions">
          <button class="button primary" type="submit">${cache.editing ? "Guardar cambios" : "Crear lead"}</button>
          ${cache.editing ? `<button class="button ghost" data-cancel-edit type="button">Cancelar</button>` : ""}
          <p id="lead-message" class="form-message"></p>
        </div>
      </form>
    </section>

    <section class="card">
      <h2>Filtros</h2>
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

    <section id="lead-table">${renderLeadTable(cache.leads, state)}</section>
  `;

  bindLeadEvents(container, state);
}

function leadFormFields(state, lead = {}) {
  lead = lead || {};
  const selectedAgent = lead.assigned_agent_id || state.agent?.id || "";
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
      <select name="status">${optionList(LEAD_STATUSES, lead.status || "Nuevo")}</select>
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
          </label>`
        : `<input name="assigned_agent_id" type="hidden" value="${escapeHtml(selectedAgent)}" />`
    }
    <label>Pago confirmado
      <select name="payment_confirmed">
        <option value="false" ${lead.payment_confirmed ? "" : "selected"}>No</option>
        <option value="true" ${lead.payment_confirmed ? "selected" : ""}>Sí</option>
      </select>
    </label>
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

function bindLeadEvents(container, state) {
  const message = container.querySelector("#lead-message");
  container.querySelector("#lead-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = normalizeLeadPayload(serializeForm(form), state);

    if (payload.status === "Ganado" && !payload.payment_confirmed) {
      showMessage(message, "Un lead solo puede marcarse como Ganado si el pago o anticipo está confirmado.", "error");
      return;
    }

    try {
      const query = cache.editing
        ? state.client.from("leads").update(payload).eq("id", cache.editing.id)
        : state.client.from("leads").insert(payload);
      const { error } = await query;
      if (error) throw error;
      showMessage(message, cache.editing ? "Lead actualizado." : "Lead creado.", "success");
      cache.editing = null;
      await loadData(state);
      paint(container, state);
    } catch (error) {
      showMessage(message, error.message || "No se pudo guardar el lead.", "error");
    }
  });

  container.querySelector("[data-cancel-edit]")?.addEventListener("click", () => {
    cache.editing = null;
    paint(container, state);
  });

  container.querySelector("#lead-filters").addEventListener("input", (event) => {
    const values = serializeForm(event.currentTarget);
    container.querySelector("#lead-table").innerHTML = renderLeadTable(filterLeads(values), state);
    bindTableEvents(container, state);
  });

  bindTableEvents(container, state);
}

function bindTableEvents(container, state) {
  container.querySelectorAll("[data-edit-lead]").forEach((button) => {
    button.addEventListener("click", () => {
      cache.editing = cache.leads.find((lead) => lead.id === button.dataset.editLead);
      paint(container, state);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    button.addEventListener("click", () => renderActivityForm(container, state, button.dataset.activityLead));
  });
}

function normalizeLeadPayload(values, state) {
  const payload = {
    ...values,
    status: values.status || "Nuevo",
    assigned_agent_id: values.assigned_agent_id || state.agent?.id || null,
    created_by: state.user.id,
    payment_confirmed: values.payment_confirmed === "true",
    next_follow_up_at: values.next_follow_up_at || null,
    last_contact_at: values.last_contact_at || null,
    won_at: values.status === "Ganado" && values.payment_confirmed ? new Date().toISOString() : null,
  };

  if (cache.editing) delete payload.created_by;
  return payload;
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

function renderLeadTable(leads, state) {
  if (!leads.length) return emptyState("No hay leads con estos criterios.");
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Negocio</th>
            <th>Contacto</th>
            <th>Servicio</th>
            <th>Estado</th>
            <th>Seguimiento</th>
            <th>Agente</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${leads
            .map(
              (lead) => `
              <tr>
                <td><strong>${escapeHtml(lead.business_name)}</strong><br /><span class="muted">${escapeHtml(lead.country || "")} ${escapeHtml(
                  lead.city || "",
                )}</span></td>
                <td>${escapeHtml(lead.contact_name || "")}<br /><span class="muted">${escapeHtml(lead.whatsapp || lead.email || "")}</span></td>
                <td>${escapeHtml(lead.requested_service || "")}<br /><span class="muted">${escapeHtml(lead.recommended_plan || "")}</span></td>
                <td>${leadBadge(lead.status)}</td>
                <td>${escapeHtml(lead.next_action || "")}<br /><span class="muted">${niceDate(lead.next_follow_up_at)}</span></td>
                <td>${escapeHtml(lead.agents?.profiles?.full_name || "Sin asignar")}</td>
                <td>
                  <div class="actions">
                    <button class="button" data-edit-lead="${lead.id}" type="button">Editar</button>
                    <button class="button" data-activity-lead="${lead.id}" type="button">Actividad</button>
                    ${state.isAdmin ? `<button class="button danger" data-delete-lead="${lead.id}" type="button">Eliminar</button>` : ""}
                  </div>
                </td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderActivityForm(container, state, leadId) {
  const lead = cache.leads.find((item) => item.id === leadId);
  const target = container.querySelector("#lead-table");
  target.innerHTML = `
    <section class="form-panel">
      <h2>Registrar actividad: ${escapeHtml(lead?.business_name || "")}</h2>
      <form id="activity-form" class="form-grid">
        <label>Tipo
          <select name="type">
            <option>contacto</option>
            <option>seguimiento</option>
            <option>llamada</option>
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
          <button class="button ghost" data-back-table type="button">Volver</button>
          <p id="activity-message" class="form-message"></p>
        </div>
      </form>
    </section>
  `;

  target.querySelector("[data-back-table]").addEventListener("click", () => {
    target.innerHTML = renderLeadTable(cache.leads, state);
    bindTableEvents(container, state);
  });

  target.querySelector("#activity-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = serializeForm(event.currentTarget);
    const payload = {
      lead_id: leadId,
      agent_id: lead.assigned_agent_id || state.agent?.id,
      type: values.type,
      notes: values.notes,
    };
    const { error } = await state.client.from("lead_activities").insert(payload);
    if (error) {
      showMessage(target.querySelector("#activity-message"), error.message, "error");
      return;
    }
    target.innerHTML = renderLeadTable(cache.leads, state);
    bindTableEvents(container, state);
  });
}
