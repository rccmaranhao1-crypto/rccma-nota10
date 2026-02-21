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

  const isAdmin = !!u && (u.role === "ADMIN" || u.role === "ADMIN_MASTER");
  const links = [
    { href: "/", label: "Início", key: "inicio" },
    { href: "/rcc", label: "A RCC", key: "rcc" },
    { href: "/doacoes", label: "Meu GO Nota 10", key: "nota10" },
    { href: "/campanhas", label: "Campanhas", key: "campanhas" },
    { href: "/loja", label: "Loja", key: "loja" },
    { href: "/membros", label: "Sou Carismático", key: "membros" },
  ];

  const navItem = (l) => `
    <a href="${l.href}"
      class="px-3 py-2 rounded-lg text-sm font-medium transition
      ${active === l.key ? "bg-white/10 text-white" : "text-white/80 hover:text-white hover:bg-white/10"}">
      ${l.label}
    </a>`;

  el.innerHTML = `
  <div class="w-full bg-[#1b1b2a] text-white sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4">
      <div class="h-16 flex items-center justify-between gap-3">
        <a href="/" class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold">R</div>
          <div class="leading-tight">
            <div class="font-semibold">RCC MARANHÃO</div>
            <div class="text-xs text-white/70 -mt-0.5">Portal do Meu Grupo de Oração</div>
          </div>
        </a>

        <nav class="hidden md:flex items-center gap-1">
          ${links.map(navItem).join("")}
          ${isAdmin ? `<a href="/admin" class="px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 ${active==="admin"?"bg-white/10 text-white":""}">Admin</a>` : ""}
        </nav>

        <div class="flex items-center gap-2">
          ${u
            ? `<button id="btnLogout" class="hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/15">Sair</button>`
            : `<a href="/login" class="hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/15">Entrar</a>`
          }

          <button id="btnMobileMenu" class="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15" aria-label="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <div id="mobileNav" class="md:hidden hidden pb-4">
        <div class="flex flex-col gap-1 pt-2">
          ${links.map(l => navItem(l)).join("")}
          ${isAdmin ? `<a href="/admin" class="px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 ${active==="admin"?"bg-white/10 text-white":""}">Admin</a>` : ""}
          ${u
            ? `<button id="btnLogoutMobile" class="text-left px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/15">Sair</button>`
            : `<a href="/login" class="px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/15">Entrar</a>`
          }
        </div>
      </div>
    </div>
  </div>
  `;

  const toggle = () => {
    const n = document.getElementById("mobileNav");
    if (!n) return;
    n.classList.toggle("hidden");
  };
  document.getElementById("btnMobileMenu")?.addEventListener("click", toggle);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "/";
  };
  document.getElementById("btnLogout")?.addEventListener("click", logout);
  document.getElementById("btnLogoutMobile")?.addEventListener("click", logout);
}

