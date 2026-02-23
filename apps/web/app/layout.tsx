import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RCCMA — Portal",
  description: "Portal RCC Maranhão"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <header className="flex items-center justify-between gap-4">
            <a href="/" className="text-lg font-semibold">RCCMA</a>
            <nav className="flex gap-3 text-sm">
              <a className="hover:underline" href="/rcc">A RCC</a>
              <a className="hover:underline" href="/meu-go">Meu GO Nota 10</a>
              <a className="hover:underline" href="/campanhas">Campanhas</a>
              <a className="hover:underline" href="/loja">Loja</a>
              <a className="hover:underline" href="/sou-carismatico">Sou Carismático</a>
              <a className="hover:underline" href="/adm">Área do ADM</a>
            </nav>
          </header>
          <main className="mt-6">{children}</main>
          <footer className="mt-12 border-t pt-6 text-xs text-gray-500">
            RCC Maranhão — Portal (base nova)
          </footer>
        </div>
      </body>
    </html>
  );
}
