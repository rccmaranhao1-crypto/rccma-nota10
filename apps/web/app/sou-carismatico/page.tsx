import Link from "next/link";

export default function SouCarismatico() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Sou Carismático</h1>
      <p className="text-gray-700">Acesse sua conta ou crie um cadastro.</p>

      <div className="flex gap-3">
        <Link className="rounded-lg bg-black px-4 py-2 text-white" href="/sou-carismatico/login">Entrar</Link>
        <Link className="rounded-lg border bg-white px-4 py-2" href="/sou-carismatico/cadastro">Cadastrar</Link>
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
        Dica: o ADMIN inicial é criado automaticamente no primeiro deploy (seed).
      </div>
    </div>
  );
}
