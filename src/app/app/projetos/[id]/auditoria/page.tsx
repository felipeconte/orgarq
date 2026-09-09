import { requireProjectAccess } from '@/lib/server/guard'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  User,
  Globe,
  Fingerprint,
  MessageSquare
} from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { BreadcrumbSetter } from '@/contexts/BreadcrumbContext'

export default async function ProjectAuditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, project } = await requireProjectAccess(id)

  if (!project) {
    notFound()
  }

  // Busca o histórico de auditoria
  const { data: approvals } = await supabase
    .from('stage_approvals')
    .select('*, project_stages(name, stage_order)')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const auditLogs = approvals || []

  return (
    <div className="max-w-4xl mx-auto space-y-6 antialiased">
      <BreadcrumbSetter
        items={[
          { label: 'Escritório', href: '/app' },
          { label: 'Projetos', href: '/app/projetos' },
          { label: project.title, href: `/app/projetos/${id}` },
          { label: 'Auditoria' },
        ]}
      />
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref={`/app/projetos/${id}`} />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" /> Histórico de Auditoria & Aprovações
            </h1>
            <p className="text-xs text-slate-500">
              Registros imutáveis de todas as interações e aprovações do cliente para o projeto <strong>{project.title}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        {auditLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Nenhuma aprovação registrada ainda</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Quando o cliente aprovar uma etapa ou solicitar ajustes através do Magic Link, o registro de auditoria completo aparecerá aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {auditLogs.map((log) => {
              const stage = log.project_stages as { name: string; stage_order: number } | null
              const isApproved = log.action === 'approved'

              return (
                <div key={log.id} className="relative space-y-2">
                  {/* Timeline Dot */}
                  <div
                    className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                      isApproved ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />

                  {/* Card Content */}
                  <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {stage?.name || 'Etapa do Projeto'}
                        </span>
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Aprovado pelo Cliente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Ajustes Solicitados
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    {log.feedback_message && (
                      <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <p className="leading-relaxed whitespace-pre-wrap">{log.feedback_message}</p>
                      </div>
                    )}

                    {/* Metadata Specs (IP, Approver, Hash) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {log.approver_name} {log.approver_email ? `(${log.approver_email})` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>IP: {log.ip_address || 'Anônimo / Proxy'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <Fingerprint className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono text-[10px] truncate" title={log.audit_hash}>
                          Hash: {log.audit_hash.substring(0, 16)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
