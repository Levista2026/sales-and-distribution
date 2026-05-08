const SUPABASE_URL = "https://leyiexbcueohoewidaof.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wH-NBUQEVxOCO_lK2XjaNQ_GiyDeUqr";
const AUTH_KEY = "sd_dashboard_auth";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (localStorage.getItem(AUTH_KEY) === "1") {
  window.location.href = "./index.html";
}

const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  msg.textContent = "";

  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error || !data?.session) {
    msg.textContent = error?.message || "Login failed. Check email/password.";
    return;
  }

  localStorage.setItem(AUTH_KEY, "1");
  window.location.href = "./index.html";
});
