import { copyText, emptyState, escapeHtml, SCRIPT_CATEGORIES, optionList, serializeForm, showMessage } from "./utils.js";

export async function renderScripts(container, state) {
  const { data: scripts = [], error } = await state.client.from("scripts").select("*").order("updated_at", { ascending: false });
  if (error) throw error;

  container.innerHTML = `
    ${
      state.isAdmin
        ? `<section class="form-panel">
            <h2>Crear guion oficial</h2>
            <form id="script-form" class="form-grid">
              <label>Título <input name="title" required /></label>
              <label>Categoría
                <select name="category">${optionList(SCRIPT_CATEGORIES)}</select>
              </label>
              <label>Activo
                <select name="active"><option value="true">Sí</option><option value="false">No</option></select>
              </label>
              <label class="full">Contenido <textarea name="content" required></textarea></label>
              <div class="full actions">
                <button class="button primary" type="submit">Guardar guion</button>
                <p id="script-message" class="form-message"></p>
              </div>
            </form>
          </section>`
        : ""
    }
    <section class="grid two">
      ${scripts.length ? scripts.map((script) => scriptCard(script, state)).join("") : emptyState("No hay guiones disponibles.")}
    </section>
  `;

  container.querySelectorAll("[data-copy-script]").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.copyScript, button));
  });

  container.querySelectorAll("[data-toggle-script]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { error: updateError } = await state.client
        .from("scripts")
        .update({ active: button.dataset.nextActive === "true" })
        .eq("id", button.dataset.toggleScript);
      if (updateError) throw updateError;
      await renderScripts(container, state);
    });
  });

  container.querySelector("#script-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = container.querySelector("#script-message");
    const values = serializeForm(event.currentTarget);
    const payload = {
      ...values,
      active: values.active === "true",
      created_by: state.user.id,
    };
    const { error: insertError } = await state.client.from("scripts").insert(payload);
    if (insertError) {
      showMessage(message, insertError.message, "error");
      return;
    }
    showMessage(message, "Guion guardado.", "success");
    await renderScripts(container, state);
  });
}

function scriptCard(script, state) {
  if (!state.isAdmin && !script.active) return "";
  return `
    <article class="card">
      <div class="copy-row">
        <div>
          <h2>${escapeHtml(script.title)}</h2>
          <span class="badge">${escapeHtml(script.category)}</span>
          ${script.active ? "" : `<span class="badge danger">Inactivo</span>`}
        </div>
        <button class="button" data-copy-script="${escapeHtml(script.content)}" type="button">Copiar</button>
      </div>
      <p class="script-content">${escapeHtml(script.content)}</p>
      ${
        state.isAdmin
          ? `<button class="button ghost" data-toggle-script="${script.id}" data-next-active="${!script.active}" type="button">${
              script.active ? "Desactivar" : "Activar"
            }</button>`
          : ""
      }
    </article>
  `;
}
