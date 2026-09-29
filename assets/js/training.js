import { emptyState, escapeHtml, niceDate } from "./utils.js";

const checklist = [
  "Leer manual completo",
  "Revisar servicios y precios",
  "Practicar guiones",
  "Registrar primeros prospectos",
  "Enviar primeros mensajes",
  "Participar en revisión de objeciones",
  "Confirmar lectura y aceptación del proceso",
];

export async function renderTraining(container, state) {
  const [{ data: modules = [] }, { data: progress = [] }] = await Promise.all([
    state.client.from("training_modules").select("*").eq("active", true).order("order_index"),
    state.agent
      ? state.client.from("training_progress").select("*").eq("agent_id", state.agent.id)
      : Promise.resolve({ data: [] }),
  ]);

  const completed = new Set(progress.filter((item) => item.completed).map((item) => item.module_id));
  container.innerHTML = `
    <section class="grid two">
      <article class="card">
        <h2>Checklist de capacitación</h2>
        <ul class="list">${checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
      <article class="card">
        <h2>Progreso</h2>
        <div class="metric">
          <span>Módulos completados</span>
          <strong>${completed.size}/${modules.length}</strong>
        </div>
        <p class="muted">Marca cada módulo cuando confirmes su lectura y práctica.</p>
      </article>
    </section>

    <section class="grid two">
      ${
        modules.length
          ? modules.map((module) => renderModule(module, completed.has(module.id), state)).join("")
          : emptyState("No hay módulos activos de capacitación.")
      }
    </section>
  `;

  container.querySelectorAll("[data-complete-module]").forEach((button) => {
    button.addEventListener("click", async () => {
      const moduleId = button.dataset.completeModule;
      const payload = {
        agent_id: state.agent.id,
        module_id: moduleId,
        completed: true,
        completed_at: new Date().toISOString(),
      };
      const { error } = await state.client.from("training_progress").upsert(payload, { onConflict: "agent_id,module_id" });
      if (error) throw error;
      await renderTraining(container, state);
    });
  });
}

function renderModule(module, completed, state) {
  return `
    <article class="card">
      <div class="copy-row">
        <div>
          <h2>${escapeHtml(module.title)}</h2>
          <p class="muted">${escapeHtml(module.description || "")}</p>
        </div>
        <span class="badge ${completed ? "success" : "warning"}">${completed ? "Completado" : "Pendiente"}</span>
      </div>
      <p>${escapeHtml(module.content || "")}</p>
      ${
        state.agent
          ? `<button class="button primary" data-complete-module="${module.id}" type="button" ${completed ? "disabled" : ""}>Marcar completado</button>`
          : `<p class="muted">Vista admin. El progreso se marca desde usuarios agentes.</p>`
      }
      ${completed ? `<p class="muted">Completado ${niceDate(new Date().toISOString())}</p>` : ""}
    </article>
  `;
}
