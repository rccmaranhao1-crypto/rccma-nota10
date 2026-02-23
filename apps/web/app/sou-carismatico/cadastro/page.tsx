"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { DIOCESES } from "../../../lib/dioceses";

function toISO(dateBR: string) {
  // dd/mm/aaaa -> aaaa-mm-ddT00:00:00.000Z
  const m = /^([0-3]\d)\/([01]\d)\/(\d{4})$/.exec(dateBR.trim());
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
}

export default function CadastroPage() {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [birthDateBR, setBirthDateBR] = useState("");
  const [diocese, setDiocese] = useState(DIOCESES[0].value);
  const [city, setCity] = useState("");
  const [prayerGroup, setPrayerGroup] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const birthISO = useMemo(() => toISO(birthDateBR), [birthDateBR]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!birthISO) {
      setMsg("Data inválida. Use dd/mm/aaaa.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          whatsapp,
          birthDate: birthISO,
          diocese,
          city,
          prayerGroup,
          password
        })
      });
      localStorage.setItem("token", data.token);
      setMsg("Cadastro OK. Redirecionando...");
      window.location.href = "/adm";
    } catch (err: any) {
      setMsg(err.message || "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Cadastro</h1>
      <p className="mt-1 text-sm text-gray-600">Todos os campos são obrigatórios.</p>

      <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
        <label className="text-sm">
          Nome
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={name} onChange={e=>setName(e.target.value)} required />
        </label>

        <label className="text-sm">
          WhatsApp
          <input className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="(99) 99999-9999" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} required />
        </label>

        <label className="text-sm">
          Data de nascimento (dd/mm/aaaa)
          <input className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="31/12/1990" value={birthDateBR} onChange={e=>setBirthDateBR(e.target.value)} required />
        </label>

        <label className="text-sm">
          Diocese
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={diocese} onChange={e=>setDiocese(e.target.value)} required>
            {DIOCESES.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Cidade
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={city} onChange={e=>setCity(e.target.value)} required />
        </label>

        <label className="text-sm">
          Grupo de Oração
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={prayerGroup} onChange={e=>setPrayerGroup(e.target.value)} required />
        </label>

        <label className="text-sm">
          Senha
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </label>

        <button className="mt-2 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50" disabled={loading}>
          {loading ? "Salvando..." : "Criar conta"}
        </button>
      </form>

      {msg ? <p className="mt-3 text-sm text-gray-700">{msg}</p> : null}
    </div>
  );
}
