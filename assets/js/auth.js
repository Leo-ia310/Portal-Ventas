import { hasSupabaseConfig, supabase, getProfile } from "./supabase.js";
import { showMessage } from "./utils.js";

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const button = document.querySelector("#login-button");
const message = document.querySelector("#auth-message");
const setupWarning = document.querySelector("#setup-warning");

if (!hasSupabaseConfig()) {
  setupWarning.hidden = false;
  button.disabled = true;
}

async function redirectIfLoggedIn() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    window.location.replace("dashboard.html");
  }
}

redirectIfLoggedIn();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  button.textContent = "Validando...";
  showMessage(message, "", "");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });
    if (error) throw error;
    await getProfile(data.user.id);
    window.location.replace("dashboard.html");
  } catch (error) {
    showMessage(message, error.message || "No se pudo iniciar sesión.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Iniciar sesión";
  }
});
