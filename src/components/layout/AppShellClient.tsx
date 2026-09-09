'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  LayoutDashboard,
  FolderGit2,
  Plus,
  SlidersHorizontal,
  Settings,
  LogOut,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  Briefcase,
  CircleDollarSign,
} from 'lucide-react'
import { logoutAction } from '@/lib/actions/auth'
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

interface AppShellClientProps {
  officeName: string
  orgLogoUrl: string | null
  userDisplayName: string
  userAvatarUrl: string | null
  userRole: string
  pendingClientUpdatesCount: number
  children: React.ReactNode
}

export function AppShellClient({
  officeName,
  orgLogoUrl,
  userDisplayName,
  userAvatarUrl,
  userRole,
  pendingClientUpdatesCount,
  children,
}: AppShellClientProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  // Sincroniza estado inicial com localStorage de forma segura para SSR
  useEffect(() => {
    try {
      const saved = localStorage.getItem('orgarq_sidebar_collapsed')
      if (saved !== null) {
        setIsCollapsed(saved === 'true')
      }
    } catch {
      // Ignora erro de acesso ao localStorage se restrito
    }
  }, [])

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('orgarq_sidebar_collapsed', String(next))
      } catch {
        // Ignora erro
      }
      return next
    })
  }

  const getInitials = (name: string) => {
    if (!name) return 'AR'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const mainNavItems = [
    {
      href: '/app',
      label: 'Visão Geral',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/app/clientes',
      label: 'Clientes',
      icon: Users,
      badge: pendingClientUpdatesCount,
    },
    {
      href: '/app/projetos',
      label: 'Projetos',
      icon: FolderGit2,
    },
    {
      href: '/app/empresas',
      label: 'Empresas e Serviços',
      icon: Briefcase,
    },
    {
      href: '/app/financeiro',
      label: 'Financeiro',
      icon: CircleDollarSign,
    },
  ]

  const configNavItems = [
    {
      href: '/app/configuracoes/etapas-fluxo',
      label: 'Etapas do Projeto',
      icon: KanbanSquare,
    },
    {
      href: '/app/configuracoes/etapas',
      label: 'Template de Tarefas',
      icon: SlidersHorizontal,
    },
    {
      href: '/app/configuracoes/escritorio',
      label: 'Dados do Escritório',
      icon: Settings,
    },
    {
      href: '/app/configuracoes/perfil',
      label: 'Meu Perfil',
      icon: User,
    },
  ]

  const checkIsActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800 antialiased">
      {/* Sidebar Lateral */}
      <aside
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 fixed inset-y-0 z-20 transition-all duration-300 ease-in-out`}
      >
        {/* Botão flutuante na borda para recolher/expandir */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-6 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-600 shadow-xs hover:bg-slate-50 hover:text-blue-600 transition-all cursor-pointer hover:scale-110 active:scale-95"
          title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
          {/* Logo & Nome da Empresa */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            {isCollapsed ? (
              <Link
                href="/app"
                className="flex items-center justify-center w-full group"
                title={officeName}
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shadow-blue-500/10 overflow-hidden shrink-0 border border-slate-200/80 group-hover:scale-105 transition-transform">
                  {orgLogoUrl ? (
                    <img
                      src={orgLogoUrl}
                      alt={officeName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
              </Link>
            ) : (
              <Link
                href="/app"
                className="flex items-center gap-3 min-w-0 flex-1 group"
                title={officeName}
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shadow-blue-500/10 overflow-hidden shrink-0 border border-slate-200/80 group-hover:scale-105 transition-transform">
                  {orgLogoUrl ? (
                    <img
                      src={orgLogoUrl}
                      alt={officeName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {officeName}
                  </span>
                </div>
              </Link>
            )}
          </div>

          {/* Botão de Ação Rápida: Novo Projeto */}
          <div className="p-3">
            {isCollapsed ? (
              <div className="flex justify-center">
                <Link
                  href="/app/projetos/novo"
                  className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs shadow-blue-500/20 group hover:scale-105"
                  title="Novo Projeto"
                >
                  <Plus className="w-5 h-5" />
                </Link>
              </div>
            ) : (
              <Link
                href="/app/projetos/novo"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-xs shadow-blue-500/20"
                title="Novo Projeto"
              >
                <Plus className="w-4.5 h-4.5 shrink-0" />
                <span>Novo Projeto</span>
              </Link>
            )}
          </div>

          {/* Links de Navegação Principal */}
          <nav className="px-3 space-y-1">
            {/* Categoria Escritório */}
            {isCollapsed ? (
              <div
                className="my-2 mx-2 border-t border-slate-100"
                title="Escritório"
              />
            ) : (
              <div className="pt-2 pb-1.5 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Escritório
              </div>
            )}

            {mainNavItems.map((item) => {
              const isActive = checkIsActive(item.href, item.exact)
              const Icon = item.icon

              if (isCollapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all relative group ${
                      isActive
                        ? 'bg-slate-100 text-blue-600 font-semibold shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-blue-600'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {item.badge && item.badge > 0 ? (
                      <span
                        className="absolute top-2 right-2 flex h-2 w-2"
                        title={`${item.badge} solicitação(ões) pendente(s)`}
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    ) : null}
                  </Link>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group ${
                    isActive
                      ? 'bg-slate-100 text-blue-600 font-semibold shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4.5 h-4.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span
                      className="flex h-2 w-2 relative shrink-0"
                      title={`${item.badge} solicitação(ões) de atualização cadastral pendente(s)`}
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  ) : null}
                </Link>
              )
            })}

            {/* Separador de Configurações */}
            {isCollapsed ? (
              <div
                className="my-3 mx-2 border-t border-slate-100"
                title="Configurações"
              />
            ) : (
              <div className="pt-4 pb-1.5 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Configurações
              </div>
            )}

            {/* Links de Configuração */}
            {configNavItems.map((item) => {
              const isActive = checkIsActive(item.href)
              const Icon = item.icon

              if (isCollapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all relative group ${
                      isActive
                        ? 'bg-slate-100 text-blue-600 font-semibold shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-blue-600'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                  </Link>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-slate-100 text-blue-600 font-semibold shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-blue-600 font-medium'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Rodapé / Card de Perfil do Usuário */}
        <div className="p-3 border-t border-slate-100">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/app/configuracoes/perfil"
                className="flex items-center justify-center group"
                title={`Perfil: ${userDisplayName} (${userRole})`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-2xs border border-white group-hover:scale-105 transition-transform">
                  {userAvatarUrl ? (
                    <img
                      src={userAvatarUrl}
                      alt={userDisplayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(userDisplayName)}</span>
                  )}
                </div>
              </Link>

              <form action={logoutAction} className="shrink-0">
                <button
                  type="submit"
                  title="Sair da Conta"
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors group">
              <Link
                href="/app/configuracoes/perfil"
                className="flex items-center gap-2.5 flex-1 min-w-0"
                title="Acessar Configurações de Perfil"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-2xs border border-white">
                  {userAvatarUrl ? (
                    <img
                      src={userAvatarUrl}
                      alt={userDisplayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(userDisplayName)}</span>
                  )}
                </div>
                <div className="truncate">
                  <span className="text-sm font-semibold text-slate-800 block truncate group-hover:text-blue-600 transition-colors">
                    {userDisplayName}
                  </span>
                  <span className="text-xs font-medium text-slate-400 capitalize block truncate">
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
          )}
        </div>
      </aside>

      {/* Conteúdo Principal com padding dinâmico */}
      <div
        className={`${
          isCollapsed ? 'pl-20' : 'pl-64'
        } flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out`}
      >
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-8 py-3.5 flex items-center justify-between">
          <Breadcrumbs />
        </header>

        <main className="p-8 lg:p-8 flex-1 max-w-[1600px] w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  </BreadcrumbProvider>
  )
}
