import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const PLACEHOLDER_URL = "https://TU-PROYECTO.supabase.co";
const PLACEHOLDER_KEY = "TU_SUPABASE_ANON_KEY_PUBLICA";

async function loadConfig() {
  try {
    const module = await import("./config.js");
    return module.SUPABASE_CONFIG || window.MKD_SUPABASE_CONFIG || {};
  } catch (error) {
    return window.MKD_SUPABASE_CONFIG || {};
  }
}

export const SUPABASE_CONFIG = await loadConfig();

export function hasSupabaseConfig() {
  return Boolean(
    SUPABASE_CONFIG.url &&
      SUPABASE_CONFIG.anonKey &&
      SUPABASE_CONFIG.url !== PLACEHOLDER_URL &&
      SUPABASE_CONFIG.anonKey !== PLACEHOLDER_KEY,
  );
}

export const supabase = hasSupabaseConfig()
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getAgentByUser(userId) {
  const { data, error } = await supabase
    .from("agents")
    .select("id,user_id,country,phone,whatsapp,availability,status,compensation_mode,commission_rate,base_salary,start_date")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAppContext() {
  const session = await getSession();
  if (!session) return null;
  const profile = await getProfile(session.user.id);
  const agent = await getAgentByUser(session.user.id);
  return {
    session,
    user: session.user,
    profile,
    agent,
    isAdmin: profile.role === "admin",
  };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  window.location.replace("login.html");
}
