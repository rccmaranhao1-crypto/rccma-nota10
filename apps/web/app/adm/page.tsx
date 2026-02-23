"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../../lib/api";

type Me = {
  id: string;
  name: string;
  whatsapp: string;
  role: string;
  diocese: string;
};

export default function AdmPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState<string>("Carregando...");
  const [adminPing, setAdminPing] = useState<string>("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMsg("Você não está logado. Vá em Sou Carismático > Login.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Falha no /me");
        setMe(data);
        setMsg("");
      } catch (e: any) {
        setMsg(e.message || "Erro ao carregar perfil");
      }
    })();
  }, []);

  async function pingAdmin() {
    setAdminPing("Carregando...");
    const token = localStorage.getItem("token");
    if (!token) return setAdminPing("Sem token.");
    try {
      const res = await fetch(`${API_URL}/admin/ping`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Sem permissão");
      setAdminPing(JSON.stringify(data));
    } catch (e: any) {
      setAdminPing(e.message || "Erro");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Área do ADM</h1>

      {msg ? <div className="rounded-xl border bg-white p-4 text-sm text-gray-700">{msg}</div> : null}

      {me ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Usuário</div>
            <div className="mt-1 font-medium">{me.name}</div>
            <div className="text-sm text-gray-700">{me.whatsapp}</div>
            <div className="mt-2 inline-flex rounded-full border px-3 py-1 text-xs">{me.role}</div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Ações rápidas</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-lg bg-black px-4 py-2 text-sm text-white" onClick={pingAdmin}>
                Testar permissão ADMIN
              </button>
              <button
                className="rounded-lg border bg-white px-4 py-2 text-sm"
                onClick={() => { localStorage.removeItem("token"); window.location.href="/"; }}
              >
                Sair
              </button>
            </div>
            {adminPing ? <pre className="mt-3 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">{adminPing}</pre> : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
        Aqui entraremos com os dashboards e o menu por perfil (ADMIN/COMUNICAÇÃO/TESOUREIRO/ARRECADAÇÃO/USER).
      </div>
    </div>
  );
}
