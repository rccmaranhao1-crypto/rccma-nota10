const API = "";

export function getToken() {
  return localStorage.getItem("token");
}

export function setAuth(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getUser() {
  const raw = localStorage.getItem("user");
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API + path, { ...opts, headers });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || `Erro ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function moneyBRLFromCents(cents) {
  const n = (Number(cents || 0) / 100).toFixed(2);
  return n.replace(".", ",");
}

export function requireAdmin() {
  const u = getUser();
  if (!getToken() || !u) {
    location.href = "/login";
    return;
  }
  if (u.role !== "ADMIN") {
    alert("Acesso restrito.");
    location.href = "/";
  }
}

export function renderTopbar(active) {
  const el = document.querySelector("#topbar");
  if (!el) return;
  const u = getUser();

  el.innerHTML = `
  <div class="w-full bg-[#1b1b2a] text-white">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center font-bold">R</div>
        <div class="leading-tight">
          <div class="font-semibold">RCC MA • Nota 10</div>
          <div class="text-xs text-white/70">Portal do Meu Grupo de Oração</div>
        </div>
      </a>

      <div class="flex items-center gap-2">
        <a class="px-3 py-2 rounded-lg text-sm ${active==="membros"?"bg-white/10":"hover:bg-white/10"}" href="/membros">Membros</a>
        <a class="px-3 py-2 rounded-lg text-sm ${active==="doacoes"?"bg-white/10":"hover:bg-white/10"}" href="/doacoes">Doações</a>
        <a class="px-3 py-2 rounded-lg text-sm ${active==="loja"?"bg-white/10":"hover:bg-white/10"}" href="/loja">Loja</a>
        ${u?.role === "ADMIN" ? `<a class="px-3 py-2 rounded-lg text-sm ${active==="admin"?"bg-white/10":"hover:bg-white/10"}" href="/admin">Admin</a>` : ""}

        <div class="ml-2 flex items-center gap-2">
          ${u ? `<span class="text-sm text-white/80 hidden sm:inline">Olá, <b>${u.nome}</b></span>
                 <button id="logoutBtn" class="px-3 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20">Sair</button>`
              : `<a class="px-3 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20" href="/login">Entrar</a>`}
        </div>
      </div>
    </div>
  </div>`;

  const btn = document.querySelector("#logoutBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      clearAuth();
      location.href = "/";
    });
  }
}
