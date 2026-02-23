"use client";

import { useState } from "react";
import { apiFetch } from "../../../lib/api";

export default function LoginPage() {
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ whatsapp, password })
      });
      localStorage.setItem("token", data.token);
      setMsg("Login OK. Vá para a Área do ADM.");
      window.location.href = "/adm";
    } catch (err: any) {
      setMsg(err.message || "Erro ao logar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Login</h1>
      <p className="mt-1 text-sm text-gray-600">Use WhatsApp + senha.</p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          WhatsApp
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="(99) 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Senha
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button
          className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {msg ? <p className="mt-3 text-sm text-gray-700">{msg}</p> : null}
    </div>
  );
}
