# Orgarq

O **Orgarq** é uma plataforma SaaS B2B moderna, limpa e responsiva, desenvolvida sob medida para escritórios e profissionais de arquitetura. O sistema une a gestão interna de fluxos técnicos à comunicação descomplicada e aprovação ágil por parte do cliente final.

## 🚀 Funcionalidades Principais

- **Gestão de Projetos & Briefing**: Ficha de briefing integrada, levantamento de necessidades e metas físicas/financeiras.
- **Fluxo de Trabalho em 10 Fases**: Templates customizáveis de etapas com controle de progresso ponderado.
- **Multivisualização Dinâmica (Lista, Kanban & Gantt)**: Visualize cronogramas e entregas no estilo que preferir.
- **Portal do Cliente (Zero Friction)**: Acesso seguro via Magic Link ou Token único, sem necessidade de senha, para acompanhar o status e aprovar ou solicitar ajustes nas etapas com auditoria imutável (IP, timestamp, e-mail e user-agent gravados).

## 🛠️ Stack Tecnológica

- **Frontend**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/) (ClickUp 3.0 Light Style)
- **Banco de Dados & Autenticação**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, SSR)
- **Componentes & Ícones**: [Lucide React](https://lucide.dev/), [Leaflet](https://leafletjs.com/) para mapas

## 📦 Primeiros Passos

### 1. Clonar e Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com base no `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Executar o Servidor de Desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver o resultado.

## 🛡️ Segurança & Arquitetura

O desenvolvimento do Orgarq é governado por regras mandatórias descritas detalhadamente na pasta `docs/`:

- **Row Level Security (RLS)** habilitado em todas as tabelas do Supabase.
- **Server Actions & Guards** (`requireAuth`, `requireOrgAccess`, `requireProjectAccess`) para proteção contra ataques IDOR.
- **Sanitização de Inputs** (XSS prevention) no servidor usando `src/lib/server/sanitize.ts`.
- **Cabeçalhos de Segurança HTTP** robustos configurados via `next.config.ts`.

Para mais detalhes de arquitetura e requisitos do produto, acesse a pasta [/docs](./docs).
