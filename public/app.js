
(function(){
  const token = localStorage.getItem("token");
  const logoutBtn = document.getElementById("logoutBtn");
  const loginBtn = document.getElementById("loginBtn");
  if (token) {
    if (logoutBtn) logoutBtn.style.display = "";
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("name");
      location.href = "/index.html";
    });
  } else {
    if (logoutBtn) logoutBtn.style.display = "none";
    if (loginBtn) loginBtn.style.display = "";
  }
})();
const API = "";

function qs(sel){return document.querySelector(sel)}
function qsa(sel){return Array.from(document.querySelectorAll(sel))}

function getToken(){return localStorage.getItem("token")}
function setToken(t){localStorage.setItem("token", t)}
function clearToken(){localStorage.removeItem("token"); localStorage.removeItem("user")}
function setUser(u){localStorage.setItem("user", JSON.stringify(u))}
function getUser(){ try { return JSON.parse(localStorage.getItem("user")||"null") } catch { return null } }

async function api(path, {method="GET", body, auth=true} = {}){
  const headers = {"Content-Type":"application/json"};
  if (auth && getToken()) headers["Authorization"] = "Bearer " + getToken();
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.message || "Erro");
  return data;
}

function navActive(){
  const p = location.pathname.replace(/\/$/,"") || "/";
  qsa(".nav a, .mobileMenu a").forEach(a=>{
    const href = a.getAttribute("href"); if (!href) return;
    const h = href.replace(/\/$/,"");
    if (h === p) a.classList.add("active"); else a.classList.remove("active");
  });
}

function toggleMobile(){ const m = qs("#mobileMenu"); if (m) m.classList.toggle("show"); }

async function loadStatus(){
  const el = qs("#statusText"); if (!el) return;
  try{ const st = await api("/api/status", {auth:false}); el.textContent = st.ok ? "Online • Banco OK" : "Offline"; }
  catch{ el.textContent = "Offline • Banco ERRO"; }
}

async function hydrateAuthUI(){
  const btnLogin = qs("#btnLogin");
  const btnLogout = qs("#btnLogout");
  const user = getUser();
  if (btnLogin && btnLogout){
    if (user?.nome){
      btnLogin.style.display="none";
      btnLogout.style.display="inline-flex";
      btnLogout.onclick = ()=>{ clearToken(); location.href="/"; };
    } else {
      btnLogin.style.display="inline-flex";
      btnLogout.style.display="none";
    }
  }
}

async function ensureMe(){
  if (!getToken()) return null;
  try{
    const me = await api("/api/me");
    setUser(me);
    return me;
  }catch{
    clearToken();
    return null;
  }
}

async function loadContent(slug){
  const titleEl = qs("#pageTitle");
  const bodyEl  = qs("#pageBody");
  if (!titleEl || !bodyEl) return;
  const data = await api(`/api/content/${slug}`, {auth:false});
  titleEl.textContent = data.title;
  bodyEl.innerHTML = (data.body || "").replace(/\n/g,"<br>");
}

async function loadSouCarismatico(){
  const box = qs("#souWrap"); if (!box) return;
  const me = await ensureMe();
  if (me){
    box.innerHTML = `
      <div class="card" style="padding:16px">
        <h2 style="margin:0 0 6px">Sou Carismático</h2>
        <div class="small">Você está logado como <b>${me.nome}</b> (${me.role}).</div>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">Sou Carismático</h2>
      <div class="small">Faça cadastro ou login para acessar recursos e participar de campanhas.</div>
      <div style="height:12px"></div>
      <div class="row2">
        <div>
          <h3 style="margin:0 0 10px">Cadastro</h3>
          <div class="form">
            <input id="r_nome" placeholder="Nome completo" />
            <input id="r_whats" placeholder="WhatsApp (apenas números)" />
            <input id="r_senha" placeholder="Senha" type="password" />
            <div class="row2">
              <input id="r_nasc" placeholder="Nascimento (AAAA-MM-DD)" />
              <input id="r_cidade" placeholder="Cidade" />
            </div>
            <div class="row2">
              <input id="r_diocese" placeholder="Diocese" />
              <input id="r_grupo" placeholder="Grupo de Oração" />
            </div>
            <button class="btn primary" id="btnRegister">Cadastrar</button>
            <span class="small" id="msgRegister"></span>
          </div>
        </div>
        <div>
          <h3 style="margin:0 0 10px">Login</h3>
          <div class="form">
            <input id="l_whats" placeholder="WhatsApp" />
            <input id="l_senha" placeholder="Senha" type="password" />
            <button class="btn primary" id="btnLoginDo">Entrar</button>
            <span class="small" id="msgLogin"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  qs("#btnRegister").onclick = async ()=>{
    qs("#msgRegister").textContent = "Cadastrando...";
    try{
      const out = await api("/api/auth/register", {method:"POST", auth:false, body:{
        nome: qs("#r_nome").value.trim(),
        whatsapp: qs("#r_whats").value.trim(),
        senha: qs("#r_senha").value,
        nascimento: qs("#r_nasc").value || null,
        cidade: qs("#r_cidade").value.trim(),
        diocese: qs("#r_diocese").value.trim(),
        grupo_oracao: qs("#r_grupo").value.trim(),
      }});
      setToken(out.token); setUser(out.user); location.href="/";
    }catch(e){ qs("#msgRegister").textContent = "❌ " + e.message; }
  };

  qs("#btnLoginDo").onclick = async ()=>{
    qs("#msgLogin").textContent = "Entrando...";
    try{
      const out = await api("/api/auth/login", {method:"POST", auth:false, body:{
        whatsapp: qs("#l_whats").value.trim(),
        senha: qs("#l_senha").value
      }});
      setToken(out.token); setUser(out.user); location.href="/";
    }catch(e){ qs("#msgLogin").textContent = "❌ " + e.message; }
  };
}

async function loadMeuGO(){
  const wrap = qs("#goWrap"); if (!wrap) return;
  const me = await ensureMe();
  if (!me){ wrap.innerHTML = `<div class="notice">Faça login em <b>Sou Carismático</b> para registrar contribuições.</div>`; return; }

  wrap.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">Meu GO Nota 10</h2>
      <div class="small">Registre sua contribuição. PagBank (PIX/cartão) entra na próxima etapa.</div>
      <div style="height:12px"></div>
      <div class="form">
        <div class="row3">
          <div><label>Valor (R$)</label><input id="go_valor" placeholder="Ex.: 25.00" /></div>
          <div><label>Diocese</label><input id="go_diocese" placeholder="Ex.: São Luís" /></div>
          <div><label>Grupo de Oração</label><input id="go_grupo" placeholder="Ex.: Emanuel" /></div>
        </div>
        <div class="row2">
          <div>
            <label>Método (futuro PagBank)</label>
            <select id="go_metodo">
              <option value="PENDENTE">Escolher depois</option>
              <option value="PIX">PIX</option>
              <option value="CARTAO">Cartão</option>
            </select>
          </div>
          <div style="display:flex;align-items:flex-end;gap:10px">
            <button class="btn primary" id="go_send">Registrar</button>
            <span class="small" id="go_msg"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  qs("#go_send").onclick = async ()=>{
    qs("#go_msg").textContent = "Enviando...";
    try{
      await api("/api/contributions", {method:"POST", body:{
        valor: qs("#go_valor").value,
        diocese: qs("#go_diocese").value,
        grupo_oracao: qs("#go_grupo").value,
        metodo: qs("#go_metodo").value,
      }});
      qs("#go_msg").textContent = "✅ Registrado (pendente)";
      qs("#go_valor").value = "";
    }catch(e){ qs("#go_msg").textContent = "❌ " + e.message; }
  };
}

async function loadCampanhas(){
  const wrap = qs("#campWrap"); if (!wrap) return;
  const list = await api("/api/campaigns", {auth:false});
  wrap.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">Campanhas</h2>
      <div class="small">Rifas com cotas, vendedores e reserva. Pagamento será integrado ao PagBank depois.</div>
    </div>
    <div style="height:12px"></div>
    ${list.map(c=>`
      <div class="card" style="padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="margin:0 0 6px">${c.titulo}</h3>
            <div class="small">${c.descricao}</div>
            <div class="small" style="margin-top:8px"><b>Valor:</b> R$ ${(c.valor_cota_cents/100).toFixed(2)} • <b>Cotas:</b> ${c.total_cotas} • <b>Status:</b> ${c.status}</div>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start">
            <a class="btn" href="/campanha.html?id=${c.id}">Ver cotas</a>
          </div>
        </div>
      </div>
    `).join("") || `<div class="notice">Nenhuma campanha cadastrada ainda.</div>`}
  `;
}

async function loadCampanhaSingle(){
  const wrap = qs("#campOneWrap"); if (!wrap) return;
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id){ wrap.innerHTML = `<div class="notice">Campanha inválida.</div>`; return; }

  const camp = await api(`/api/campaigns/${id}`, {auth:false});
  const quotas = await api(`/api/campaigns/${id}/quotas`, {auth:false});
  const me = await ensureMe();

  let sellers = [];
  if (me && me.role === "ADMIN_MASTER"){
    try{ sellers = await api(`/api/campaigns/${id}/sellers`); }catch{}
  }

  const available = quotas.filter(q=>q.status==="DISPONIVEL").length;

  wrap.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">${camp.titulo}</h2>
      <div class="small">${camp.descricao}</div>
      <div class="small" style="margin-top:8px"><b>Disponíveis:</b> ${available} • <b>Valor:</b> R$ ${(camp.valor_cota_cents/100).toFixed(2)}</div>
    </div>
    <div style="height:12px"></div>
    <div class="card" style="padding:16px">
      <h3 style="margin:0 0 10px">Comprar/Reservar cota</h3>
      ${me ? `
        <div class="form">
          <div class="row3">
            <div><label>Cota</label><input id="p_quota" placeholder="Ex.: 0007" /></div>
            <div><label>Nome do comprador</label><input id="p_nome" placeholder="Seu nome" value="${me.nome||""}"/></div>
            <div><label>WhatsApp do comprador</label><input id="p_whats" placeholder="Seu WhatsApp" value="${me.whatsapp||""}"/></div>
          </div>
          <div class="row2">
            <div>
              <label>Vendedor (obrigatório)</label>
              ${sellers.length ? `
                <select id="p_seller">${sellers.map(s=>`<option value="${s.id}">${s.nome} (${s.whatsapp})</option>`).join("")}</select>
                <div class="small">Obs.: lista para usuários será liberada na próxima revisão.</div>
              ` : `
                <input id="p_seller" placeholder="Informe o ID do vendedor (temporário)" />
                <div class="small">Temporário: na próxima revisão vamos listar vendedores para qualquer usuário.</div>
              `}
            </div>
            <div style="display:flex;align-items:flex-end;gap:10px">
              <button class="btn primary" id="p_buy">Reservar</button>
              <span class="small" id="p_msg"></span>
            </div>
          </div>
        </div>
      ` : `<div class="notice">Faça login em <b>Sou Carismático</b> para reservar uma cota.</div>`}
    </div>
    <div style="height:12px"></div>
    <div class="card" style="padding:16px">
      <h3 style="margin:0 0 10px">Cotas</h3>
      <div class="small">Mostrando até 5000 cotas.</div>
      <div style="height:10px"></div>
      <div style="overflow:auto;max-height:520px">
        <table class="table">
          <thead><tr><th>Número</th><th>Status</th><th>Comprador</th></tr></thead>
          <tbody>${quotas.map(q=>`
            <tr><td><b>${q.numero}</b></td><td>${q.status}</td><td>${q.buyer_nome ? `${q.buyer_nome} (${q.buyer_whatsapp||""})` : ""}</td></tr>
          `).join("")}</tbody>
        </table>
      </div>
    </div>
  `;

  const btn = qs("#p_buy");
  if (btn){
    btn.onclick = async ()=>{
      qs("#p_msg").textContent = "Reservando...";
      try{
        const sellerVal = sellers.length ? qs("#p_seller").value : qs("#p_seller").value.trim();
        await api(`/api/campaigns/${id}/purchase`, {method:"POST", body:{
          quota_numero: qs("#p_quota").value.trim(),
          seller_user_id: Number(sellerVal),
          buyer_nome: qs("#p_nome").value.trim(),
          buyer_whatsapp: qs("#p_whats").value.trim()
        }});
        qs("#p_msg").textContent = "✅ Reservada (pendente)";
      }catch(e){ qs("#p_msg").textContent = "❌ " + e.message; }
    };
  }
}

async function loadAdmin(){
  const wrap = qs("#adminWrap"); if (!wrap) return;
  const me = await ensureMe();
  if (!me){ wrap.innerHTML = `<div class="notice">Faça login para acessar o Admin.</div>`; return; }
  if (!["ADMIN_MASTER","COMUNICACAO","TESOUREIRO"].includes(me.role)){
    wrap.innerHTML = `<div class="notice">Sem permissão.</div>`; return;
  }

  const canEditContent = (me.role==="ADMIN_MASTER" || me.role==="COMUNICACAO");
  const canSeeReports = (me.role==="ADMIN_MASTER" || me.role==="TESOUREIRO");
  const isMaster = (me.role==="ADMIN_MASTER");

  wrap.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">Admin</h2>
      <div class="small">Logado como <b>${me.nome}</b> (${me.role})</div>
    </div>
    <div style="height:12px"></div>
    ${canEditContent ? `
      <div class="card" style="padding:16px">
        <h3 style="margin:0 0 10px">Conteúdo (Início / A RCC)</h3>
        <div class="row2">
          <div>
            <label>Editar</label>
            <select id="contentSlug">
              <option value="home">Início</option>
              <option value="rcc">A RCC</option>
            </select>
          </div>
          <div>
            <label>Título</label>
            <input id="contentTitle" placeholder="Título" />
          </div>
        </div>
        <div style="height:10px"></div>
        <label>Texto</label>
        <textarea id="contentBody" placeholder="Conteúdo..."></textarea>
        <div style="height:10px"></div>
        <button class="btn primary" id="saveContent">Salvar</button>
        <span class="small" id="contentMsg" style="margin-left:10px"></span>
      </div>
      <div style="height:12px"></div>
    ` : ""}
    ${canSeeReports ? `
      <div class="card" style="padding:16px">
        <h3 style="margin:0 0 10px">Relatório — Contribuições</h3>
        <button class="btn" id="loadContrib">Carregar</button>
        <div style="height:10px"></div>
        <div style="overflow:auto">
          <table class="table" id="tblContrib">
            <thead><tr><th>Data</th><th>Nome</th><th>WhatsApp</th><th>Valor</th><th>Diocese</th><th>Grupo</th><th>Status</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div style="height:12px"></div>
    ` : ""}
    ${isMaster ? `
      <div class="card" style="padding:16px">
        <h3 style="margin:0 0 10px">Usuários & Perfis</h3>
        <button class="btn" id="loadUsers">Carregar</button>
        <div style="height:10px"></div>
        <div style="overflow:auto">
          <table class="table" id="tblUsers">
            <thead><tr><th>ID</th><th>Nome</th><th>WhatsApp</th><th>Perfil</th><th>Ação</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    ` : ""}
  `;

  if (canEditContent){
    const slugSel = qs("#contentSlug");
    const title = qs("#contentTitle");
    const body  = qs("#contentBody");
    const msg   = qs("#contentMsg");
    async function load(){
      msg.textContent = "";
      const c = await api(`/api/content/${slugSel.value}`, {auth:false});
      title.value = c.title || "";
      body.value = c.body || "";
    }
    slugSel.onchange = load;
    qs("#saveContent").onclick = async ()=>{
      msg.textContent = "Salvando...";
      try{ await api(`/api/content/${slugSel.value}`, {method:"PUT", body:{title:title.value, body:body.value}}); msg.textContent="✅ Salvo!"; }
      catch(e){ msg.textContent="❌ " + e.message; }
    };
    await load();
  }

  if (canSeeReports){
    qs("#loadContrib").onclick = async ()=>{
      const tb = qs("#tblContrib tbody");
      tb.innerHTML = `<tr><td colspan="7">Carregando...</td></tr>`;
      try{
        const rows = await api("/api/reports/contributions");
        tb.innerHTML = rows.map(r=>`
          <tr>
            <td>${new Date(r.created_at).toLocaleString()}</td>
            <td>${r.nome}</td>
            <td>${r.whatsapp}</td>
            <td>R$ ${(r.valor_cents/100).toFixed(2)}</td>
            <td>${r.diocese||""}</td>
            <td>${r.grupo_oracao||""}</td>
            <td>${r.status}</td>
          </tr>
        `).join("") || `<tr><td colspan="7">Sem dados</td></tr>`;
      }catch(e){ tb.innerHTML = `<tr><td colspan="7">Erro: ${e.message}</td></tr>`; }
    };
  }

  if (isMaster){
    qs("#loadUsers").onclick = async ()=>{
      const tb = qs("#tblUsers tbody");
      tb.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;
      try{
        const users = await api("/api/admin/users");
        tb.innerHTML = users.map(u=>`
          <tr>
            <td>${u.id}</td><td>${u.nome}</td><td>${u.whatsapp}</td>
            <td>
              <select data-role="${u.id}">
                ${["ADMIN_MASTER","COMUNICACAO","TESOUREIRO","USER"].map(r=>`<option value="${r}" ${u.role===r?"selected":""}>${r}</option>`).join("")}
              </select>
            </td>
            <td><button class="btn" data-save="${u.id}">Salvar</button></td>
          </tr>
        `).join("") || `<tr><td colspan="5">Sem usuários</td></tr>`;

        qsa("[data-save]").forEach(btn=>{
          btn.onclick = async ()=>{
            const id = btn.getAttribute("data-save");
            const sel = qs(`select[data-role="${id}"]`);
            btn.textContent = "Salvando...";
            try{ await api(`/api/admin/users/${id}/role`, {method:"PUT", body:{role: sel.value}}); btn.textContent="✅"; setTimeout(()=>btn.textContent="Salvar",800); }
            catch(e){ btn.textContent="❌"; setTimeout(()=>btn.textContent="Salvar",800); alert(e.message); }
          };
        });
      }catch(e){ tb.innerHTML = `<tr><td colspan="5">Erro: ${e.message}</td></tr>`; }
    };
  }
}

document.addEventListener("DOMContentLoaded", async ()=>{
  navActive();
  loadStatus();
  hydrateAuthUI();
  await ensureMe();
  const page = document.body.getAttribute("data-page");
  if (page==="home") await loadContent("home");
  if (page==="rcc") await loadContent("rcc");
  if (page==="sou") await loadSouCarismatico();
  if (page==="meugo") await loadMeuGO();
  if (page==="campanhas") await loadCampanhas();
  if (page==="campanha") await loadCampanhaSingle();
  if (page==="admin") await loadAdmin();
  const hb = qs("#hamburger"); if (hb) hb.onclick = toggleMobile;
});

// Destaques (home)
(function(){
  if (location.pathname === "/" || location.pathname.endsWith("/index.html") || location.pathname === "/index.html") {
    const el = document.getElementById("highlights");
    if (!el) return;
    const items = [
      { title: "Encontro Estadual", date: "Em breve", text: "Programação e inscrições serão divulgadas aqui." },
      { title: "Comunicado", date: "Atualizado", text: "Acompanhe as novidades da RCC Maranhão pelo portal." },
      { title: "Campanhas", date: "Novo módulo", text: "Crie campanhas e acompanhe as cotas por vendedor." },
    ];
    el.innerHTML = items.map(i => `
      <div class="card">
        <div class="cardTop">
          <div>
            <div class="cardTitle">${i.title}</div>
            <div class="cardSub">${i.date}</div>
          </div>
        </div>
        <div class="cardBody">${i.text}</div>
      </div>
    `).join("");
  }
})();
