import { emptyState, escapeHtml, niceDate, serializeForm, showMessage } from "./utils.js";

export async function renderDocuments(container, state) {
  const { data: documents = [], error } = await state.client.from("documents").select("*").order("updated_at", { ascending: false });
  if (error) throw error;

  container.innerHTML = `
    ${
      state.isAdmin
        ? `<section class="form-panel">
            <h2>Registrar documento comercial</h2>
            <form id="document-form" class="form-grid">
              <label>Nombre <input name="title" required /></label>
              <label>Categoría <input name="category" required /></label>
              <label>Enlace o archivo <input name="url" type="url" required /></label>
              <label>Versión <input name="version" value="1.0" /></label>
              <label>Visible para agentes
                <select name="visible_to_agents"><option value="true">Sí</option><option value="false">No</option></select>
              </label>
              <label class="wide">Descripción <textarea name="description"></textarea></label>
              <div class="full actions">
                <button class="button primary" type="submit">Guardar documento</button>
                <p id="document-message" class="form-message"></p>
              </div>
            </form>
          </section>`
        : ""
    }
    <section class="grid two">
      ${documents.length ? documents.map((document) => documentCard(document, state)).join("") : emptyState("No hay documentos disponibles.")}
    </section>
  `;

  container.querySelector("#document-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = container.querySelector("#document-message");
    const values = serializeForm(event.currentTarget);
    const payload = { ...values, visible_to_agents: values.visible_to_agents === "true" };
    const { error: insertError } = await state.client.from("documents").insert(payload);
    if (insertError) {
      showMessage(message, insertError.message, "error");
      return;
    }
    showMessage(message, "Documento guardado.", "success");
    await renderDocuments(container, state);
  });
}

function documentCard(document, state) {
  if (!state.isAdmin && !document.visible_to_agents) return "";
  return `
    <article class="card">
      <div class="copy-row">
        <div>
          <h2>${escapeHtml(document.title)}</h2>
          <span class="badge">${escapeHtml(document.category || "Documento")}</span>
          ${document.visible_to_agents ? "" : `<span class="badge warning">Solo admin</span>`}
        </div>
        <a class="button" href="${escapeHtml(document.url)}" target="_blank" rel="noreferrer">Abrir</a>
      </div>
      <p>${escapeHtml(document.description || "")}</p>
      <p class="muted document-url">Versión ${escapeHtml(document.version || "1.0")} · Actualizado ${niceDate(document.updated_at)}</p>
    </article>
  `;
}
