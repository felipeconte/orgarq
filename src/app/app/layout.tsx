import { requireAuth } from '@/lib/server/guard'
import Link from 'next/link'
import {
  Building2,
  LayoutDashboard,
  FolderGit2,
  Plus,
  SlidersHorizontal,
  Settings,
  LogOut,
  ExternalLink,
  User,
  Users,
  ChevronRight,
  KanbanSquare
} from 'lucide-react'
import { logoutAction } from '@/lib/actions/auth'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = await requireAuth()

  // Busca dados da organização do usuário
  const { data: member } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, slug, logo_url)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const org = member?.organizations as { id: string; name: string; slug: string; logo_url: string | null } | null
  const officeName = org?.name || 'Meu Escritório de Arquitetura'

  // Busca perfil na tabela dedicada user_profiles
  const { data: dbProfile } = await supabase
    .from('user_profiles')
    .select('full_name, display_name, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle()

  // Dados do usuário
  const meta = user.user_metadata || {}
  const userDisplayName = dbProfile?.full_name || dbProfile?.display_name || meta.full_name || meta.display_name || user.email?.split('@')[0] || 'Arquiteto'
  const userAvatarUrl = dbProfile?.avatar_url || meta.avatar_url || null
  const userRole = member?.role || 'owner'

  const getInitials = (name: string) => {
    if (!name) return 'AR'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Busca se há solicitações de atualização cadastral de clientes pendentes
  let pendingClientUpdatesCount = 0
  if (org?.id) {
    const { count } = await supabase
      .from('client_update_requests')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'pending')
    pendingClientUpdatesCount = count || 0
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800 antialiased">
      {/* Sidebar (ClickUp Style) */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 fixed inset-y-0 z-20">
        <div>
          {/* Brand & Organization */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <Link href="/app" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 overflow-hidden shrink-0">
                {org?.logo_url ? (
                  <img src={org.logo_url} alt={officeName} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div className="truncate">
                <span className="text-sm font-bold text-slate-900 block leading-tight">Orgarq</span>
                <span className="text-[11px] font-medium text-slate-500 truncate block max-w-[140px]">
                  {officeName}
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Action Button */}
          <div className="p-3">
            <Link
              href="/app/projetos/novo"
              className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" /> Novo Projeto
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1 text-xs font-semibold">
            <Link
              href="/app"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              Visão Geral
            </Link>

            <Link
              href="/app/clientes"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Clientes</span>
              </div>
              {pendingClientUpdatesCount > 0 && (
                <span className="flex h-2 w-2 relative" title={`${pendingClientUpdatesCount} solicitação(ões) de atualização cadastral pendente(s)`}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
              )}
            </Link>

            <Link
              href="/app/projetos"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 transition-all"
            >
              <FolderGit2 className="w-4 h-4" />
              Projetos & Fases
            </Link>

            <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Configurações
            </div>

            <Link
              href="/app/configuracoes/etapas-fluxo"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 transition-all"
            >
              <KanbanSquare className="w-4 h-4" />
              Etapas do Projeto
            </Link>

            <Link
              href="/app/configuracoes/etapas"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 transition-all"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Template de Tarefas
            </Link>

            <Link
              href="/app/configuracoes/escritorio"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 transition-all"
            >
              <Settings className="w-4 h-4" />
              Dados do Escritório
            </Link>

            <Link
              href="/app/configuracoes/perfil"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 transition-all"
            >
              <User className="w-4 h-4" />
              Meu Perfil
            </Link>
          </nav>
        </div>

        {/* User Profile & Logout Bottom Card */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors group">
            <Link
              href="/app/configuracoes/perfil"
              className="flex items-center gap-2.5 flex-1 min-w-0"
              title="Acessar Configurações de Perfil"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-2xs border border-white">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={userDisplayName} className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(userDisplayName)}</span>
                )}
              </div>
              <div className="truncate">
                <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-blue-600 transition-colors">
                  {userDisplayName}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 capitalize block truncate">
                  {userRole}
                </span>
              </div>
            </Link>

            <form action={logoutAction} className="shrink-0">
              <button
                type="submit"
                title="Sair da Conta"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Escritório</span>
            <span>/</span>
            <span className="text-slate-900">{officeName}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600"
            >
              Ver Landing Page <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </header>

        <main className="p-8 lg:p-8 flex-1 max-w-[1600px] w-full mx-auto space-y-6">{children}</main>
      </div>
    </div>
  )
}
