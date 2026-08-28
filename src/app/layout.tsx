import type { Metadata, Viewport } from "next";
import "./globals.css";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://orgarq.com.br";

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Orgarq — Gestão de Projetos de Arquitetura",
    template: "%s | Orgarq",
  },
  description:
    "A plataforma SaaS definitiva para escritórios de arquitetura: cronogramas por etapas, Kanban ágil, Gantt e aprovação simplificada no Portal do Cliente sem senha.",
  keywords: [
    "gestão de projetos de arquitetura",
    "software para arquitetos",
    "cronograma de arquitetura",
    "portal do cliente arquitetura",
    "etapas AsBEA",
    "SaaS arquitetura",
    "aprovação de pranchas",
  ],
  authors: [{ name: "Orgarq Studio" }],
  creator: "Orgarq",
  publisher: "Orgarq",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: baseUrl,
    title: "Orgarq — Gestão de Projetos de Arquitetura",
    description:
      "Controle prazos, visualize etapas em Lista, Kanban e Gantt, e colete aprovações com auditoria no Portal do Cliente.",
    siteName: "Orgarq",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orgarq — Gestão de Projetos de Arquitetura",
    description:
      "Plataforma completa de gestão de etapas, Kanban e portal do cliente para arquitetos.",
  },
};

import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-slate-800 selection:bg-blue-100 selection:text-blue-700">
        <ConfirmProvider>
          {children}
        </ConfirmProvider>
      </body>
    </html>
  );
}
