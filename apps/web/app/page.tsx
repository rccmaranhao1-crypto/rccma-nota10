export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Portal RCC Maranhão</h1>
      <p className="text-gray-700">
        Esta é a nova base profissional do portal. As abas já estão organizadas e prontas para evoluir.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <a className="rounded-xl border bg-white p-4 shadow-sm hover:shadow" href="/meu-go">
          <div className="font-medium">Meu GO Nota 10</div>
          <div className="text-sm text-gray-600">Contribuição via PIX ou Cartão (PagBank) — em breve.</div>
        </a>
        <a className="rounded-xl border bg-white p-4 shadow-sm hover:shadow" href="/campanhas">
          <div className="font-medium">Campanhas</div>
          <div className="text-sm text-gray-600">Rifas com cotas, vendedores e dashboard.</div>
        </a>
        <a className="rounded-xl border bg-white p-4 shadow-sm hover:shadow" href="/loja">
          <div className="font-medium">Loja</div>
          <div className="text-sm text-gray-600">Produtos, estoque e pagamento PagBank.</div>
        </a>
        <a className="rounded-xl border bg-white p-4 shadow-sm hover:shadow" href="/sou-carismatico">
          <div className="font-medium">Sou Carismático</div>
          <div className="text-sm text-gray-600">Cadastro/Login com permissões.</div>
        </a>
      </div>
    </div>
  );
}
