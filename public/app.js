const API = "";

function qs(s){return document.querySelector(s)}
function qsa(s){return Array.from(document.querySelectorAll(s))}
function token(){return localStorage.getItem("token")}
function setToken(t){localStorage.setItem("token", t)}
function setUser(u){localStorage.setItem("user", JSON.stringify(u))}
function user(){ try{ return JSON.parse(localStorage.getItem("user")||"null") }catch{return null} }
function logout(){ localStorage.removeItem("token"); localStorage.removeItem("user"); location.href="/"; }

async function api(path, {method="GET", body, auth=true}={}){
  const headers={"Content-Type":"application/json"};
  if (auth && token()) headers["Authorization"]="Bearer "+token();
  const res = await fetch(API+path, {method, headers, body: body?JSON.stringify(body):undefined});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.message || "Erro");
  return data;
}

function navActive(){
  const p = location.pathname.replace(/\/$/,"") || "/";
  qsa(".nav a, .mobileMenu a").forEach(a=>{
    const h = (a.getAttribute("href")||"").replace(/\/$/,"") || "/";
    if (h===p) a.classList.add("active"); else a.classList.remove("active");
  });
}

function toggleMobile(){ const m=qs("#mobileMenu"); if(m) m.classList.toggle("show"); }

async function loadStatus(){
  const el=qs("#statusText"); if(!el) return;
  try{ const st=await api("/api/status",{auth:false}); el.textContent = st.ok ? "Online • Banco OK" : "Offline"; }
  catch{ el.textContent="Offline • Banco ERRO"; }
}

async function ensureMe(){
  if(!token()) return null;
  try{ const me=await api("/api/me"); setUser(me); return me; }
  catch{ logout(); return null; }
}

async function hydrateHeader(){
  const me = await ensureMe();
  const btnLogin=qs("#btnLogin"); const btnLogout=qs("#btnLogout");
  if(btnLogin && btnLogout){
    if(me?.nome){ btnLogin.style.display="none"; btnLogout.style.display="inline-flex"; btnLogout.onclick=logout; }
    else { btnLogin.style.display="inline-flex"; btnLogout.style.display="none"; }
  }
  const hb=qs("#hamburger"); if(hb) hb.onclick=toggleMobile;
}

async function loadContent(slug){
  const t=qs("#pageTitle"); const b=qs("#pageBody");
  if(!t||!b) return;
  const data=await api(`/api/content/${slug}`,{auth:false});
  t.textContent=data.title; b.innerHTML=(data.body||"").replace(/\n/g,"<br>");
}

async function loadDioceses(selectEl){
  const list = await api("/api/dioceses",{auth:false});
  selectEl.innerHTML = `<option value="">Selecione…</option>` + list.map(d=>`<option value="${d.id}">${d.nome}</option>`).join("");
}

function normalizeWhats(w){ return String(w||"").replace(/\D/g,""); }

async function pageSou(){
  const wrap=qs("#souWrap"); if(!wrap) return;
  const me = await ensureMe();
  if(me){
    wrap.innerHTML = `
      <div class="card" style="padding:16px">
        <h2 style="margin:0 0 6px">Sou Carismático</h2>
        <div class="small">Logado como <b>${me.nome}</b> • Perfil: <b>${me.role}</b></div>
        <div style="height:10px"></div>
        <div class="notice">Use o menu <b>Admin</b> se você tiver permissão.</div>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">Sou Carismático</h2>
      <div class="small">Cadastro e Login (WhatsApp como login). Todos os campos são obrigatórios.</div>
      <div style="height:12px"></div>
      <div class="row2">
        <div>
          <h3 style="margin:0 0 10px">Criar conta</h3>
          <div class="form">
            <div><label>Nome</label><input id="r_nome" /></div>
            <div><label>WhatsApp (DDD+9 dígitos)</label><input id="r_whats" placeholder="(99) 9XXXX-XXXX" /></div>
            <div class="row2">
              <div><label>Nascimento</label><input id="r_nasc" placeholder="AAAA-MM-DD" /></div>
              <div><label>Diocese</label><select id="r_diocese"></select></div>
            </div>
            <div class="row2">
              <div><label>Cidade</label><input id="r_cidade" /></div>
              <div><label>Grupo de Oração</label><input id="r_grupo" /></div>
            </div>
            <div><label>Email (opcional)</label><input id="r_email" placeholder="seu@email.com" /></div>
            <div><label>Senha</label><input id="r_senha" type="password" /></div>
            <button class="btn primary" id="btnRegister">Cadastrar</button>
            <span class="small" id="msgRegister"></span>
          </div>
        </div>
        <div>
          <h3 style="margin:0 0 10px">Login</h3>
          <div class="form">
            <div><label>WhatsApp</label><input id="l_whats" /></div>
            <div><label>Senha</label><input id="l_senha" type="password" /></div>
            <button class="btn primary" id="btnLoginDo">Entrar</button>
            <span class="small" id="msgLogin"></span>
            <div style="height:10px"></div>
            <div class="notice">
              <b>ADMIN MASTER padrão:</b><br>
              WhatsApp: <b>99982477467</b><br>
              Senha: <b>ucra01</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const dioceseSel = qs("#r_diocese");
  await loadDioceses(dioceseSel);

  qs("#btnRegister").onclick = async ()=>{
    qs("#msgRegister").textContent="Cadastrando...";
    try{
      const out = await api("/api/auth/register",{method:"POST",auth:false,body:{
        nome: qs("#r_nome").value.trim(),
        whatsapp: normalizeWhats(qs("#r_whats").value),
        senha: qs("#r_senha").value,
        nascimento: qs("#r_nasc").value,
        diocese_id: qs("#r_diocese").value,
        cidade: qs("#r_cidade").value.trim(),
        grupo_oracao: qs("#r_grupo").value.trim(),
        email: qs("#r_email").value.trim(),
      }});
      setToken(out.token); setUser(out.user); location.href="/";
    }catch(e){ qs("#msgRegister").textContent="❌ "+e.message; }
  };

  qs("#btnLoginDo").onclick = async ()=>{
    qs("#msgLogin").textContent="Entrando...";
    try{
      const out = await api("/api/auth/login",{method:"POST",auth:false,body:{
        whatsapp: normalizeWhats(qs("#l_whats").value),
        senha: qs("#l_senha").value
      }});
      setToken(out.token); setUser(out.user); location.href="/";
    }catch(e){ qs("#msgLogin").textContent="❌ "+e.message; }
  };
}

async function pageMeuGO(){
  const wrap=qs("#goWrap"); if(!wrap) return;
  const me = await ensureMe();
  if(!me){ wrap.innerHTML = `<div class="notice">Faça login em <b>Sou Carismático</b> para contribuir.</div>`; return; }
  wrap.innerHTML = `
    <div class="card hero">
      <div>
        <h1><span class="grad">Meu GO Nota 10</span></h1>
        <p>Projeto de arrecadação mensal da RCC Maranhão. Você é convidado a ser fiel mensalmente com <b>R$ 10</b>.</p>
        <div style="height:14px"></div>
        <div class="small">PagBank (PIX/Cartão) está preparado — você poderá ativar assim que tiver o token.</div>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-weight:950">Registrar contribuição</div>
        <div class="small" style="margin-top:8px">Campos usados nos relatórios por diocese e grupo.</div>
        <div style="height:10px"></div>
        <div class="form">
          <div class="row2">
            <div><label>Valor (R$)</label><input id="go_valor" placeholder="Ex.: 10.00" /></div>
            <div><label>Diocese</label><select id="go_diocese"></select></div>
          </div>
          <div><label>Grupo de Oração</label><input id="go_grupo" placeholder="Ex.: Emanuel" value="${me.grupo_oracao||""}" /></div>
          <div class="row2">
            <div><label>Método</label>
              <select id="go_metodo">
                <option value="PIX">PIX</option>
                <option value="CARTAO">Cartão</option>
              </select>
            </div>
            <div style="display:flex;align-items:flex-end;gap:10px">
              <button class="btn primary" id="go_send">Continuar</button>
              <span class="small" id="go_msg"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  await loadDioceses(qs("#go_diocese"));
  // preselect user's diocese if available
  // (we don't have diocese_id on /me response, so user can select)
  qs("#go_send").onclick = async ()=>{
    qs("#go_msg").textContent="Registrando...";
    try{
      const out = await api("/api/contribuicoes",{method:"POST",body:{
        valor: qs("#go_valor").value,
        diocese_id: qs("#go_diocese").value,
        grupo_oracao: qs("#go_grupo").value.trim(),
        metodo: qs("#go_metodo").value
      }});
      qs("#go_msg").textContent = "✅ Registrado. (Pagamento PagBank será acionado aqui)";
      // Aqui, na integração final, chamaremos /api/pagbank/pix ou /api/pagbank/cartao usando contribution_id
    }catch(e){ qs("#go_msg").textContent="❌ "+e.message; }
  };
}

async function pageCampanhas(){
  const wrap=qs("#campWrap"); if(!wrap) return;
  const list = await api("/api/campanhas",{auth:false});
  wrap.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">Campanhas</h2>
      <div class="small">Rifas com cotas sequenciais. Reserva exige vendedor obrigatório. PagBank preparado.</div>
    </div>
    <div style="height:12px"></div>
    ${list.map(c=>`
      <div class="card" style="padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="margin:0 0 6px">${c.titulo}</h3>
            <div class="small">${c.descricao}</div>
            <div class="small" style="margin-top:8px">
              <b>Valor:</b> R$ ${(c.valor_cota_cents/100).toFixed(2)} •
              <b>Cotas:</b> ${c.total_cotas} •
              <b>Reserva:</b> ${c.reserva_minutos} min
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start">
            <a class="btn" href="/campanha.html?id=${c.id}">Ver cotas</a>
          </div>
        </div>
      </div>
    `).join("") || `<div class="notice">Nenhuma campanha cadastrada.</div>`}
  `;
}

function chunk(arr, size){
  const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}

async function pageCampanha(){
  const wrap=qs("#campOneWrap"); if(!wrap) return;
  const id = new URLSearchParams(location.search).get("id");
  if(!id){ wrap.innerHTML=`<div class="notice">Campanha inválida.</div>`; return; }
  const all = await api("/api/campanhas",{auth:false});
  const camp = all.find(x=>String(x.id)===String(id));
  if(!camp){ wrap.innerHTML=`<div class="notice">Campanha não encontrada.</div>`; return; }
  const cotas = await api(`/api/campanhas/${id}/cotas`,{auth:false});
  const me = await ensureMe();

  // vendedores: por enquanto carregamos só para quem está logado (e master/tesoureiro/comunicação tem endpoint)
  let sellers=[];
  try{
    if(me) sellers = await api(`/api/campanhas/${id}/vendedores`);
  }catch{ sellers=[]; }

  const dispo = cotas.filter(c=>c.status==="DISPONIVEL").length;

  const grid = chunk(cotas, 10).map(row=>`
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      ${row.map(c=>`
        <span class="pill" style="cursor:pointer;opacity:${c.status==="DISPONIVEL" ? 1 : .55}" data-num="${c.numero}" data-status="${c.status}">
          #${c.numero} • ${c.status}
        </span>
      `).join("")}
    </div>
  `).join("");

  wrap.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">${camp.titulo}</h2>
      <div class="small">${camp.descricao}</div>
      <div style="height:10px"></div>
      <div class="kpi">
        <div class="card"><div class="small">Disponíveis</div><div style="font-weight:950;font-size:20px">${dispo}</div></div>
        <div class="card"><div class="small">Valor por cota</div><div style="font-weight:950;font-size:20px">R$ ${(camp.valor_cota_cents/100).toFixed(2)}</div></div>
        <div class="card"><div class="small">Reserva</div><div style="font-weight:950;font-size:20px">${camp.reserva_minutos} min</div></div>
      </div>
    </div>

    <div style="height:12px"></div>

    <div class="card" style="padding:16px">
      <h3 style="margin:0 0 10px">Reservar cota (vendedor obrigatório)</h3>
      ${me ? `
        <div class="form">
          <div class="row3">
            <div><label>Cota</label><input id="p_num" placeholder="Ex.: 7" /></div>
            <div><label>Nome</label><input id="p_nome" value="${me.nome||""}" /></div>
            <div><label>WhatsApp</label><input id="p_whats" value="${me.whatsapp||""}" /></div>
          </div>
          <div class="row2">
            <div>
              <label>Vendedor</label>
              ${sellers.length ? `
                <select id="p_seller">${sellers.map(s=>`<option value="${s.id}">${s.nome} (${s.whatsapp})</option>`).join("")}</select>
              ` : `
                <div class="notice">Ainda não há vendedores cadastrados para esta campanha (ou você não tem permissão para listar). Peça ao ADMIN MASTER para cadastrar.</div>
                <input id="p_seller" placeholder="ID do vendedor (temporário)" />
              `}
            </div>
            <div style="display:flex;align-items:flex-end;gap:10px">
              <button class="btn primary" id="p_reservar">Reservar</button>
              <span class="small" id="p_msg"></span>
            </div>
          </div>
          <div class="small">Após integração PagBank, o pagamento PIX/cartão será iniciado logo após a reserva.</div>
        </div>
      ` : `<div class="notice">Faça login em <b>Sou Carismático</b> para reservar.</div>`}
    </div>

    <div style="height:12px"></div>

    <div class="card" style="padding:16px">
      <h3 style="margin:0 0 10px">Cotas</h3>
      <div class="small">Clique em uma cota disponível para preencher automaticamente.</div>
      <div style="height:10px"></div>
      <div style="max-height:520px;overflow:auto">${grid}</div>
    </div>
  `;

  qsa("[data-num]").forEach(el=>{
    el.onclick=()=>{
      if(el.getAttribute("data-status")!=="DISPONIVEL") return;
      const n = el.getAttribute("data-num");
      const inp=qs("#p_num"); if(inp) inp.value=n;
      window.scrollTo({top:0,behavior:"smooth"});
    };
  });

  const btn=qs("#p_reservar");
  if(btn){
    btn.onclick=async ()=>{
      qs("#p_msg").textContent="Reservando...";
      try{
        const sellerVal = sellers.length ? qs("#p_seller").value : qs("#p_seller").value.trim();
        await api(`/api/campanhas/${id}/reservar`,{method:"POST",body:{
          numero: qs("#p_num").value,
          seller_user_id: sellerVal,
          buyer_nome: qs("#p_nome").value.trim(),
          buyer_whatsapp: normalizeWhats(qs("#p_whats").value)
        }});
        qs("#p_msg").textContent="✅ Reservada! (Pagamento PagBank será acionado aqui)";
      }catch(e){ qs("#p_msg").textContent="❌ "+e.message; }
    };
  }
}

async function pageAdmin(){
  const wrap=qs("#adminWrap"); if(!wrap) return;
  const me = await ensureMe();
  if(!me){ wrap.innerHTML=`<div class="notice">Faça login para acessar o Admin.</div>`; return; }

  const isMaster = me.role==="ADMIN_MASTER";
  const canCom = isMaster || me.role==="COMUNICACAO";
  const canTes = isMaster || me.role==="TESOUREIRO";

  wrap.innerHTML = `
    <div class="card" style="padding:16px">
      <h2 style="margin:0 0 6px">Admin</h2>
      <div class="small">Logado como <b>${me.nome}</b> • Perfil: <b>${me.role}</b></div>
    </div>

    <div style="height:12px"></div>

    ${canCom ? `
      <div class="card" style="padding:16px">
        <h3 style="margin:0 0 10px">Conteúdo (Início / A RCC)</h3>
        <div class="row2">
          <div><label>Página</label>
            <select id="c_slug"><option value="home">Início</option><option value="rcc">A RCC</option></select>
          </div>
          <div><label>Título</label><input id="c_title" /></div>
        </div>
        <div style="height:10px"></div>
        <label>Texto</label><textarea id="c_body"></textarea>
        <div style="height:10px"></div>
        <button class="btn primary" id="c_save">Salvar</button>
        <span class="small" id="c_msg" style="margin-left:10px"></span>
      </div>
      <div style="height:12px"></div>
    `:""}

    ${canTes ? `
      <div class="card" style="padding:16px">
        <h3 style="margin:0 0 10px">Relatório — Contribuições</h3>
        <button class="btn" id="r_load">Carregar</button>
        <div style="height:10px"></div>
        <div style="overflow:auto;max-height:420px">
          <table class="table" id="r_tbl">
            <thead><tr><th>Data</th><th>Nome</th><th>WhatsApp</th><th>Valor</th><th>Diocese</th><th>Grupo</th><th>Método</th><th>Status</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div style="height:12px"></div>
    `:""}

    ${isMaster ? `
      <div class="card" style="padding:16px">
        <h3 style="margin:0 0 10px">Usuários & Perfis</h3>
        <button class="btn" id="u_load">Carregar</button>
        <div style="height:10px"></div>
        <div style="overflow:auto;max-height:420px">
          <table class="table" id="u_tbl">
            <thead><tr><th>ID</th><th>Nome</th><th>WhatsApp</th><th>Perfil</th><th>Ação</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div style="height:12px"></div>

      <div class="card" style="padding:16px">
        <h3 style="margin:0 0 10px">Criar Campanha</h3>
        <div class="form">
          <div class="row2">
            <div><label>Título</label><input id="k_titulo" /></div>
            <div><label>Valor da cota (R$)</label><input id="k_valor" placeholder="Ex.: 5.00" /></div>
          </div>
          <div class="row2">
            <div><label>Total de cotas</label><input id="k_total" placeholder="Ex.: 200" /></div>
            <div><label>Reserva (min)</label>
              <select id="k_reserva"><option value="10">10</option><option value="30">30</option></select>
            </div>
          </div>
          <div class="row2">
            <div><label>Data sorteio (opcional)</label><input id="k_data" placeholder="AAAA-MM-DD" /></div>
            <div><label>Local sorteio (opcional)</label><input id="k_local" /></div>
          </div>
          <div><label>Descrição</label><textarea id="k_desc"></textarea></div>
          <button class="btn primary" id="k_create">Criar</button>
          <span class="small" id="k_msg"></span>
        </div>
        <div style="height:10px"></div>
        <div class="notice">Depois de criar: vá em Campanhas -> abra a campanha e, no futuro, adicionaremos o painel completo de vendedores e pagamentos.</div>
      </div>
    `:""}
  `;

  if(canCom){
    async function load(){
      const slug=qs("#c_slug").value;
      const c=await api(`/api/content/${slug}`,{auth:false});
      qs("#c_title").value=c.title||"";
      qs("#c_body").value=c.body||"";
    }
    qs("#c_slug").onchange=load;
    qs("#c_save").onclick=async ()=>{
      qs("#c_msg").textContent="Salvando...";
      try{
        await api(`/api/content/${qs("#c_slug").value}`,{method:"PUT",body:{title:qs("#c_title").value, body:qs("#c_body").value}});
        qs("#c_msg").textContent="✅ Salvo!";
      }catch(e){ qs("#c_msg").textContent="❌ "+e.message; }
    };
    await load();
  }

  if(canTes){
    qs("#r_load").onclick=async ()=>{
      const tb=qs("#r_tbl tbody");
      tb.innerHTML=`<tr><td colspan="8">Carregando...</td></tr>`;
      try{
        const rows=await api("/api/relatorios/contribuicoes");
        tb.innerHTML = rows.map(r=>`
          <tr>
            <td>${new Date(r.created_at).toLocaleString()}</td>
            <td>${r.nome}</td>
            <td>${r.whatsapp}</td>
            <td>R$ ${(r.valor_cents/100).toFixed(2)}</td>
            <td>${r.diocese||""}</td>
            <td>${r.grupo_oracao||""}</td>
            <td>${r.metodo}</td>
            <td>${r.status}</td>
          </tr>
        `).join("") || `<tr><td colspan="8">Sem dados</td></tr>`;
      }catch(e){ tb.innerHTML=`<tr><td colspan="8">Erro: ${e.message}</td></tr>`; }
    };
  }

  if(isMaster){
    qs("#u_load").onclick=async ()=>{
      const tb=qs("#u_tbl tbody");
      tb.innerHTML=`<tr><td colspan="5">Carregando...</td></tr>`;
      try{
        const users=await api("/api/admin/users");
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
        `).join("");
        qsa("[data-save]").forEach(btn=>{
          btn.onclick=async ()=>{
            const id=btn.getAttribute("data-save");
            const sel=qs(`select[data-role="${id}"]`);
            btn.textContent="Salvando...";
            try{ await api(`/api/admin/users/${id}/role`,{method:"PUT",body:{role:sel.value}}); btn.textContent="✅"; setTimeout(()=>btn.textContent="Salvar",900); }
            catch(e){ btn.textContent="❌"; setTimeout(()=>btn.textContent="Salvar",900); alert(e.message); }
          };
        });
      }catch(e){ tb.innerHTML=`<tr><td colspan="5">Erro: ${e.message}</td></tr>`; }
    };

    qs("#k_create").onclick=async ()=>{
      qs("#k_msg").textContent="Criando...";
      try{
        const out=await api("/api/campanhas",{method:"POST",body:{
          titulo: qs("#k_titulo").value.trim(),
          descricao: qs("#k_desc").value.trim(),
          valor_cota: qs("#k_valor").value,
          total_cotas: qs("#k_total").value,
          reserva_minutos: qs("#k_reserva").value,
          data_sorteio: qs("#k_data").value.trim(),
          local_sorteio: qs("#k_local").value.trim(),
          premios: []
        }});
        await api(`/api/campanhas/${out.campaign_id}/gerar-cotas`,{method:"POST",body:{}});
        qs("#k_msg").textContent=`✅ Campanha criada (#${out.campaign_id}) e cotas geradas.`;
      }catch(e){ qs("#k_msg").textContent="❌ "+e.message; }
    };
  }
}

document.addEventListener("DOMContentLoaded", async ()=>{
  navActive();
  await hydrateHeader();
  loadStatus();
  const page=document.body.getAttribute("data-page");
  if(page==="home") await loadContent("home");
  if(page==="rcc") await loadContent("rcc");
  if(page==="sou") await pageSou();
  if(page==="meugo") await pageMeuGO();
  if(page==="campanhas") await pageCampanhas();
  if(page==="campanha") await pageCampanha();
  if(page==="admin") await pageAdmin();
});
