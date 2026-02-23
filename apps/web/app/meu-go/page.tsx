export default function MeuGO() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Meu GO Nota 10</h1>
      <p className="text-gray-700">
        Fluxo: informa WhatsApp + Diocese (lista suspensa) → se já cadastrado, vai para pagamento; se não, direciona cadastro.
      </p>
      <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
        (Stub) Integração PagBank e fluxo automático será implementado no módulo donations/payments.
      </div>
    </div>
  );
}
