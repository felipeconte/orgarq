import { requireAuth } from '@/lib/server/guard'
import Link from 'next/link'
import {
  FolderGit2,
  Plus,
  ArrowRight,
  Compass,
  CheckCircle2
} from 'lucide-react'

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth()

  // 1. Busca todas as organizações onde o usuário é membro ou owner
  const { data: memberOrgs } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)

  const { data: ownedOrgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)

  const orgIdsSet = new Set<string>()
  if (memberOrgs) {
    memberOrgs.forEach((m) => orgIdsSet.add(m.organization_id))
  }
  if (ownedOrgs) {
    ownedOrgs.forEach((o) => orgIdsSet.add(o.id))
  }

  const allOrgIds = Array.from(orgIdsSet)

  // 2. Monta consulta unificada de projetos
  let query = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (allOrgIds.length > 0) {
    query = query.or(`organization_id.in.(${allOrgIds.join(',')}),created_by.eq.${user.id}`)
  } else {
    query = query.eq('created_by', user.id)
  }

  const { data: projs } = await query

  const projects = projs || []

  // Estatísticas
  const totalProjects = projects.length
  const totalArea = projects.reduce((acc, p) => acc + (p.area_sqm || 0), 0)

  return (
    <div className="space-y-8 antialiased">
      {/* Header & Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Dashboard do Escritório
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe o andamento das tarefas e aprovações de clientes em tempo real.
          </p>
        </div>

        <Link
          href="/app/projetos/novo"
          className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Projeto
        </Link>
      </div>

      {/* Metric Cards (ClickUp Clean) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Projetos Ativos</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {totalProjects}
          </div>
          <p className="text-[11px] text-slate-400">Escritório conectado ao Supabase</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Área Projetada Total</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {totalArea > 0 ? `${totalArea} m²` : '—'}
          </div>
          <p className="text-[11px] text-slate-400">Somatório de obras ativas</p>
        </div>
      </div>

      {/* Projects List & Quick Access */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Projetos Recentes</h2>
            <p className="text-xs text-slate-500">Acesse o hub completo de cada projeto com Lista, Kanban e Gantt</p>
          </div>

          <Link
            href="/app/projetos"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Nenhum projeto cadastrado ainda</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Crie seu primeiro projeto para que as tarefas do fluxo sejam clonadas automaticamente!
              </p>
            </div>
            <Link
              href="/app/projetos/novo"
              className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Cadastrar Primeiro Projeto
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                      {proj.code}
                    </span>
                    <Link
                      href={`/app/projetos/${proj.id}`}
                      className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      {proj.title}
                    </Link>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cliente: <strong>{proj.client_name}</strong> • {proj.typology || 'Residencial'} • {proj.area_sqm ? `${proj.area_sqm} m²` : 'Metragem a definir'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                  </span>
                  <Link
                    href={`/app/projetos/${proj.id}`}
                    className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold transition-all cursor-pointer"
                  >
                    Abrir Hub
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
