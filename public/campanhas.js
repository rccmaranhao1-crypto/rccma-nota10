const API = {
  campaigns: () => fetch("/api/campaigns").then(r => r.json()),
  campaign: (id) => fetch(`/api/campaigns/${id}`).then(r => r.json()),
  quotas: (id) => fetch(`/api/campaigns/${id}/quotas`).then(r => r.json()),
  reserve: (id, payload) => fetch(`/api/campaigns/${id}/reserve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(async r => {
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.message || "Erro");
    return data;
  })
};

let selectedCampaign = null;
let quotas = [];
let selected = new Set();

function money(cents){
  return (cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function setHint(msg, type=""){
  const el = document.getElementById("reserveHint");
  el.textContent = msg || "";
  el.className = "hint " + type;
}

function renderList(items){
  const el = document.getElementById("campaignList");
  if (!items.length){
    el.innerHTML = "<div class='muted'>Nenhuma campanha disponível.</div>";
    return;
  }
  el.innerHTML = items.map(c => {
    const total = Number(c.total_quotas||0);
    const paid = Number(c.paid||0);
    const reserved = Number(c.reserved||0);
    const available = total - paid - reserved;
    return `
      <button class="listItem" data-id="${c.id}">
        <div>
          <div class="liTitle">${c.title}</div>
          <div class="liSub">${money(c.price_cents)} • ${available} disponíveis • ${paid} pagas</div>
        </div>
        <div class="liBadge">${c.status}</div>
      </button>
    `;
  }).join("");

  el.querySelectorAll("[data-id]").forEach(b => b.addEventListener("click", () => loadCampaign(b.dataset.id)));
}

function renderPanel(c){
  document.getElementById("campaignPanel").style.display = "";
  document.getElementById("campTitle").textContent = c.title;
  document.getElementById("campMeta").textContent = `${money(c.price_cents)} • ${c.total_quotas} cotas • modelo ${c.model || "SEQUENTIAL"}`;

  const sel = document.getElementById("sellerSelect");
  sel.innerHTML = `<option value="">Selecione...</option>` + (c.sellers||[]).map(s => `<option value="${s.id}">${s.name}</option>`).join("");
}

function renderQuotas(){
  const grid = document.getElementById("quotaGrid");
  const stats = document.getElementById("quotaStats");
  const total = quotas.length;
  const paid = quotas.filter(q=>q.status==="PAID").length;
  const reserved = quotas.filter(q=>q.status==="RESERVED").length;
  const avail = total - paid - reserved;
  stats.textContent = `${avail} disponíveis • ${reserved} reservadas • ${paid} pagas • Selecionadas: ${selected.size}`;

  grid.innerHTML = quotas.map(q => {
    const disabled = q.status !== "AVAILABLE";
    const isSel = selected.has(q.number);
    const cls = ["quota", q.status.toLowerCase(), isSel ? "sel" : ""].join(" ");
    return `<button class="${cls}" data-n="${q.number}" ${disabled ? "disabled" : ""}>${q.number}</button>`;
  }).join("");

  grid.querySelectorAll("[data-n]").forEach(btn => {
    btn.addEventListener("click", () => {
      const n = Number(btn.dataset.n);
      if (selected.has(n)) selected.delete(n); else selected.add(n);
      renderQuotas();
    });
  });
}

async function loadCampaign(id){
  setHint("");
  selected.clear();
  const c = await API.campaign(id);
  selectedCampaign = c;
  renderPanel(c);

  quotas = await API.quotas(id);
  renderQuotas();
}

async function init(){
  const items = await API.campaigns();
  renderList(items);

  document.getElementById("clearBtn").addEventListener("click", () => {
    selected.clear();
    renderQuotas();
    setHint("");
  });

  document.getElementById("reserveBtn").addEventListener("click", async () => {
    try{
      setHint("");
      if (!selectedCampaign) return;
      const sellerId = document.getElementById("sellerSelect").value;
      const buyerName = document.getElementById("buyerName").value.trim();
      const buyerWhats = document.getElementById("buyerWhats").value.trim();

      if (!sellerId) return setHint("Selecione o vendedor (obrigatório).", "warn");
      if (!buyerName) return setHint("Informe seu nome.", "warn");
      if (selected.size === 0) return setHint("Selecione pelo menos 1 cota.", "warn");

      const payload = {
        seller_id: Number(sellerId),
        buyer_name: buyerName,
        buyer_whatsapp: buyerWhats,
        quotas: Array.from(selected).sort((a,b)=>a-b)
      };

      const res = await API.reserve(selectedCampaign.id, payload);
      setHint(res.message || "Reservado com sucesso.", "ok");
      // reload quotas
      quotas = await API.quotas(selectedCampaign.id);
      selected.clear();
      renderQuotas();
    }catch(e){
      setHint(e.message || "Erro ao reservar.", "err");
    }
  });
}

init();
