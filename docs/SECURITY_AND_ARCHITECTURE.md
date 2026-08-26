# ORGARQ — Diretrizes Mandatórias de Segurança & Arquitetura

> **Este documento define os 7 princípios de segurança, integridade de dados e arquitetura de software que DEVEM ser rigorosamente seguidos em todas as implementações do Orgarq.**

---

## 🛡️ 1. Row Level Security (RLS) Mandatório
* **Regra:** Todas as tabelas no Supabase/PostgreSQL **DEVEM** ter `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` habilitado.
* **Isolamento de Tenant:** Toda consulta ou mutação deve verificar o vínculo da organização através de `public.is_org_member(organization_id)` ou `owner_id = (SELECT auth.uid())`.
* **Subconsultas Otimizadas:** As chamadas para `auth.uid()` devem ser envelopadas em `(SELECT auth.uid())` para permitir que o PostgreSQL execute cache do identificador na sessão, evitando recálculos linha a linha.

---

## ⚙️ 2. Regras de Negócio no Lado do Servidor
* **Regra:** Nenhuma lógica de validação de estado, permissão crítica ou cálculo de datas e valores pode residir exclusivamente no cliente (browser).
* **Camada de Execução:**
  * **Server Actions** (`'use server'`) ou **Route Handlers** no Next.js.
  * **Triggers e Funções RPC com `SECURITY DEFINER`** no PostgreSQL para operações atômicas (ex: `submit_portal_approval`).

---

## 🔒 3. Blindagem Absoluta contra Ataques IDOR (Insecure Direct Object Reference)
* **Regra:** Nunca confie em identificadores (`projectId`, `stageId`, `organizationId`, `taskId`) enviados nos parâmetros de requisição.
* **Validação Obrigatória:** Antes de qualquer `SELECT`, `UPDATE` ou `DELETE`, o backend deve chamar os guards de segurança:
  * `requireAuth()`: Garante que o usuário tem sessão válida.
  * `requireOrgAccess(organizationId)`: Garante que o usuário é membro ativo da organização.
  * `requireProjectAccess(projectId)`: Garante que o projeto pertence à organização do usuário logado.

---

## 🔑 4. Proteção Rigorosa de Chaves de API & Segredos
* **`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`**: Chaves públicas autorizadas para o browser, protegidas unicamente por RLS.
* **`SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL`**:
  * **PROIBIDO** expor em código cliente, componentes com `'use client'`, propriedades de componentes ou respostas de API.
  * O arquivo `.gitignore` bloqueia permanentemente `.env*`, `env.local` e `*.env`.
  * O cabeçalho `poweredByHeader` foi desabilitado no Next.js para não expor a stack tecnológica.

---

## 🧼 5. Tratamento & Sanitização de Inputs (Prevenção XSS)
* **Regra:** Todos os dados recebidos de formulários (briefings, nomes, notas, feedbacks do cliente) devem ser validados e sanitizados antes de persistência ou renderização.
* **Módulos Disponíveis:**
  * `src/lib/server/sanitize.ts` (`sanitizeText`, `sanitizeHtml`) para remover tags maliciosas, `script`, `iframe` e manipuladores de eventos `onload`, `onerror`.

---

## 🌐 6. Configuração de CORS & Security Headers
* **Regra:** O `next.config.ts` aplica cabeçalhos HTTP de segurança de nível bancário:
  * **CORS Restrito:** Origens validadas para `/api/:path*`.
  * **Content-Security-Policy (CSP):** Restringe carregamento de scripts e estilos apenas de fontes autorizadas (Supabase, Google Fonts).
  * **Strict-Transport-Security (HSTS):** Força conexões HTTPS com `preload`.
  * **X-Frame-Options (`SAMEORIGIN`):** Previne ataques de Clickjacking.
  * **X-Content-Type-Options (`nosniff`):** Previne MIME-type sniffing.
  * **Permissions-Policy:** Bloqueia acesso a câmera, microfone e geolocalização não solicitados.

---

## 🚀 7. Metadados & SEO de Alto Nível
* **Regra:** Toda página pública deve possuir metadados semânticos completos para indexação:
  * `metadataBase`, `title` com template, `description`, `keywords` e `robots`.
  * **OpenGraph** e **Twitter Cards** para prévias ricas ao compartilhar links no WhatsApp, LinkedIn e redes sociais.
  * **`src/app/robots.ts`** configurado para indexar a landing page e proteger rotas privadas (`/app/`, `/api/`, `/portal/`).
  * **`src/app/sitemap.ts`** com geração dinâmica e atualizada de URLs públicas.
