# ORGARQ — Especificação de Produto & Arquitetura (MVP)

> **Documento Oficial de Visão de Produto, Módulos, Regras de Negócio e Design System**

---

## 1. Visão Geral do Produto

O **Orgarq** é uma plataforma SaaS B2B desenvolvida especialmente para escritórios e profissionais de arquitetura, unindo a gestão interna da produção técnica com a comunicação e aprovação simplificada por parte do cliente final.

---

## 2. Personas & Níveis de Acesso

| Perfil | Tipo de Acesso | Responsabilidades / Ações |
| :--- | :--- | :--- |
| **Arquiteto Titular (Admin)** | Supabase Auth (Email/Senha) | Gestão da organização, configuração dos templates de etapas, criação de projetos, envio de aprovações e reabertura de fases. |
| **Colaborador (Arquiteto / Estagiário)** | Supabase Auth (Email/Senha) | Atualização do status de tarefas no Kanban, preenchimento de briefings e anexos. |
| **Cliente do Projeto** | **Magic Link / Token Seguro** (Sem senha) | Visualização do status atual do seu projeto, histórico de entregas e aprovação/solicitação de ajustes com registro de auditoria. |

---

## 3. Módulos Funcionais do MVP

### 3.1. Gestão de Escritório & Templates de Fases
- Configuração do escritório (Nome, Logo, CAU/BR, Contato).
- Cadastro de **Templates de Etapas do Escritório**:
  - **10 Etapas Padrão Pré-carregadas**:
    1. `Contrato`
    2. `Briefing`
    3. `Estudo Preliminar`
    4. `Revisão`
    5. `Projeto 3D`
    6. `Revisões`
    7. `Projeto Executivo`
    8. `Entrega Final`
    9. `Suporte`
    10. `Finalizado`
  - O usuário pode adicionar novas etapas, renomear, reordenar (drag & drop) ou desativar etapas para o template do seu escritório.
  - Ao criar um novo projeto, as etapas são clonadas do template, permitindo personalizações individuais por projeto.

### 3.2. Gestão de Projetos & Briefing
- Cadastro rápido de projetos (Código, Título, Tipologia, Metragem m², Endereço, Cliente).
- Ficha de Briefing integrada com levantamento de expectativas, programa de necessidades e referências do cliente.
- Indicador visual de progresso percentual ponderado pelas etapas concluídas.

### 3.3. Cronograma Multivisualização (Lista, Kanban & Gantt) — [MVP]
- **Seletor de Visualização Dinâmico (Tabs Interativas)**:
  - 📋 **Visão em Lista**: Tabela minimalista com status de aprovação, prazos, metragens e ações rápidas.
  - 🗂️ **Visão em Kanban**: Cards arredondados divididos por status (`A Iniciar`, `Em Produção`, `Aguardando Aprovação do Cliente`, `Aprovado`).
  - 📊 **Visão em Gantt / Timeline**: Barra de tempo horizontal com marcos de entrega, dependências entre etapas e datas limite.

### 3.4. Portal do Cliente com Auditoria de Aprovação — [MVP]
- **Acesso Seguro sem Fricção (Magic Link / Token)**:
  - O cliente final acessa sua área exclusiva sem necessidade de criar conta com senha.
  - Interface otimizada e responsiva para desktop e celular.
- **Mecanismo de Aprovação & Auditoria Imutável**:
  - Ações do cliente: **Aprovar Etapa** ou **Solicitar Ajustes** com justificativa.
  - **Dados de Auditoria Capturados**: Data/hora UTC, IP de origem, User-Agent, e-mail/nome e mensagem de feedback.
  - **Regra de Acesso**: Bloqueio de edição para o cliente após aprovar; o arquiteto pode reabrir a etapa e solicitar nova aprovação a qualquer momento.

---

## 4. Design System & Identidade Visual (Estilo ClickUp 3.0 Light)

### 4.1. Filosofia Estética
* **Estilo**: *Ultra-Clean SaaS* inspirado no **ClickUp** — Fundo claro, cantos bastante arredondados (`rounded-xl` / `rounded-2xl`), sombras suaves difusas (`shadow-sm` / `shadow-md`), espaçamento generoso e elementos flutuantes.
* **Paleta de Cores**:
  * **Fundo Primário**: Branco Puro (`#FFFFFF`) e Cinza Suave (`#F8FAFC` / `#F1F5F9`).
  * **Azul Primário (ClickUp Vibrant Blue)**: `#3B82F6` (Blue 500) e `#2563EB` (Blue 600).
  * **Acentos de Suporte**:
    * Indigo & Violeta suave (`#6366F1` / `#8B5CF6`) para tags e destaques.
    * Verde Esmeralda Macio (`#10B981`) para Etapas Aprovadas.
    * Âmbar Quente (`#F59E0B`) para Etapas em Revisão do Cliente.
  * **Tipografia & Bordas**:
    * Textos em Slate 800 (`#1E293B`) com alto contraste de legibilidade.
    * Bordas sutis em Slate 200/300 (`#E2E8F0`).
    * Badges em estilo *pill* (`rounded-full`) com fundo translúcido suave.

---

## 5. Arquitetura de Páginas & Sitemap Completo

Abaixo está o mapeamento detalhado de todas as telas planejadas para o Orgarq, cobrindo a jornada de aquisição pública, autenticação, área logada do escritório e portal do cliente:

### 5.1. Páginas Públicas & Conversão
| Rota | Nome da Página | Descrição & Funcionalidades |
| :--- | :--- | :--- |
| **`/`** | **Landing Page de Apresentação** | Vitrine comercial de alto impacto no estilo ClickUp: Proposta de valor, demonstração interativa das 10 etapas, benefícios do Portal do Cliente sem senha, preview dos 3 modos de visualização (Lista, Kanban, Gantt), planos de assinatura e botão para **"Entrar"** ou **"Criar Escritório"**. |
| **`/login`** | **Autenticação de Usuários** | Login seguro para arquitetos e colaboradores via Supabase Auth (Email + Senha ou Magic Link), com opção "Lembrar-me" e link para recuperação. |
| **`/cadastro`** | **Cadastro & Onboarding** | Registro do arquiteto responsável, criação da Organização (Escritório) e instanciação automática do template padrão das 10 etapas. |
| **`/recuperar-senha`** | **Recuperação de Acesso** | Fluxo de envio de e-mail de redefinição de senha seguro pelo Supabase. |

---

### 5.2. Área Logada do Escritório (`/app`)
| Rota | Nome da Página | Descrição & Funcionalidades |
| :--- | :--- | :--- |
| **`/app`** | **Dashboard Executivo** | Painel geral com indicadores-chave: total de projetos ativos, prazos críticos da semana, etapas aguardando validação de clientes e atalhos rápidos de criação. |
| **`/app/projetos`** | **Listagem de Projetos** | Lista e grid de projetos com filtros dinâmicos por etapa atual (Contrato até Finalizado), busca por cliente, ordenação por prazo e badges visuais de status. |
| **`/app/projetos/novo`** | **Wizard de Novo Projeto** | Formulário rápido em etapas (Nome, Código ARQ, Cliente, Metragem m², Endereço, Prazo e seleção do template de fases). |
| **`/app/projetos/[id]`** | **Hub do Projeto (Fases & Produção)** | **Tela central do sistema.** Contém os dados do projeto, barra de progresso, botão para copiar/gerar Link do Cliente e o **Seletor de 3 Visualizações**: <br>• 📋 **Lista**: Visão detalhada de cada uma das 10 etapas.<br>• 🗂️ **Kanban**: Cards ágeis divididos por status operacional.<br>• 📊 **Gantt**: Linha do tempo com barras proporcionais de início e fim. |
| **`/app/projetos/[id]/briefing`** | **Ficha de Briefing** | Programa de necessidades do cliente, estilo arquitetônico desejado, orçamento previsto e notas de reunião. |
| **`/app/projetos/[id]/auditoria`** | **Histórico de Aprovações** | Linha do tempo de auditoria com todas as interações do cliente (aprovações com IP, data/hora UTC, feedback e reaberturas feitas pelo arquiteto). |
| **`/app/configuracoes/etapas`** | **Gestor de Templates de Etapas** | Interface drag & drop para customizar as 10 etapas padrão do escritório (adicionar novas fases, renomear, reordenar e definir prazos médios sugeridos). |
| **`/app/configuracoes/escritorio`** | **Perfil do Escritório & Equipe** | Logotipo do escritório, CAU/BR, CNPJ, dados de contato e gestão de convites de membros da equipe com papéis (Admin, Arquiteto, Estagiário). |

---

### 5.3. Portal Exclusivo do Cliente (`/portal/[token]`)
| Rota | Nome da Página | Descrição & Funcionalidades |
| :--- | :--- | :--- |
| **`/portal/[token]`** | **Portal do Cliente (Clean Light)** | Acesso **zero-friction** sem necessidade de login. O cliente acompanha a barra de progresso do projeto, visualiza a etapa atual e pode clicar em **"Aprovar Etapa"** ou **"Solicitar Ajustes"** preenchendo seu feedback. |
| **`/portal/[token]/sucesso`** | **Confirmação de Aprovação** | Tela de confirmação com comprovante digital da aprovação realizada com registro de data e hora. |

---

```text
src/app/
├── (public)/
│   ├── page.tsx                       # Landing Page Comercial (Raiz)
│   ├── login/page.tsx                 # Login do Escritório
│   ├── cadastro/page.tsx              # Cadastro / Onboarding
│   └── recuperar-senha/page.tsx       # Recuperação de Senha
├── (dashboard)/app/
│   ├── layout.tsx                     # Layout com Sidebar & Header do App
│   ├── page.tsx                       # Dashboard Executivo
│   ├── projetos/
│   │   ├── page.tsx                   # Listagem de Projetos
│   │   ├── novo/page.tsx              # Cadastro de Novo Projeto
│   │   └── [id]/
│   │       ├── page.tsx               # Hub do Projeto (Lista | Kanban | Gantt)
│   │       ├── briefing/page.tsx      # Ficha de Briefing
│   │       └── auditoria/page.tsx     # Histórico de Auditoria do Cliente
│   └── configuracoes/
│       ├── etapas/page.tsx            # Editor de Templates das 10 Etapas
│       └── escritorio/page.tsx        # Perfil do Escritório & Membros
└── portal/[token]/
    ├── page.tsx                       # Portal do Cliente (Zero Friction)
    └── sucesso/page.tsx               # Confirmação de Aprovação
```

---

## 6. Próximos Passos (Transição para Banco de Dados)

Após validação deste documento, o modelo relacional de banco de dados (PostgreSQL + Supabase) será elaborado contendo:
1. `organizations` & `organization_members`
2. `stage_templates` (Templates customizáveis das 10 etapas)
3. `projects` & `project_briefings`
4. `project_stages` (Etapas instanciadas com datas de início e fim para suportar Gantt)
5. `tasks` (Tarefas e checklists das etapas para suporte a Lista e Kanban)
6. `stage_approvals` (Tabela de auditoria com IP, timestamp, email e feedback)
7. `client_access_tokens` (Tokens seguros com expiração para o Portal do Cliente)
8. Políticas completas de **Row Level Security (RLS)**.

---

## 7. Funcionalidades Futuras (Roadmap Pós-MVP — Desenvolvimento Posterior)

> ⚠️ **Atenção:** Os módulos abaixo **NÃO** fazem parte do escopo do MVP inicial e serão desenvolvidos exclusivamente em versões futuras. A arquitetura inicial apenas manterá a compatibilidade técnica para suportar essas adições quando o momento chegar.

* 📁 **Módulo A: Repositório de Pranchas, Renders & BIM (Supabase Storage)**
  * Armazenamento, download e versionamento de arquivos técnicos de arquitetura (`.DWG`, `.IFC`, `.RVT`, `.PDF`).
  * Galeria de imagens em alta resolução dos renders 3D para aprovação visual.
  * Controle formal de revisões de pranchas (ex: `R00`, `R01`, `R02`).

* 💰 **Módulo B: Gestão Financeira & Honorários de Arquitetura**
  * Emissão e controle de propostas comerciais por m² ou por hora técnica.
  * Fluxo de caixa com parcelas vinculadas ao avanço e entrega de cada uma das 10 etapas.
  * Gestão de pagamentos e repasses para projetistas complementares terceirizados (estrutural, elétrico, hidráulico).

* 🏗️ **Módulo C: Diário de Obra Digital & Relatórios de Visita Técnica**
  * Upload de relatórios fotográficos geotagged com data, hora e marcação de ambiente.
  * Registro de ocorrências, clima e avanço físico vs. financeiro na obra.
  * Coleta de assinatura digital do cliente e do responsável técnico nas visitas de vistoria.
