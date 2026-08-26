import { requireProjectAccess } from '@/lib/server/guard'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  Save,
  Compass,
  Home,
  Sparkles
} from 'lucide-react'
import { updateBriefingAction } from '@/lib/actions/projects'

export default async function ProjectBriefingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, project } = await requireProjectAccess(id)

  if (!project) {
    notFound()
  }

  // Busca o briefing existente
  const { data: briefing } = await supabase
    .from('project_briefings')
    .select('*')
    .eq('project_id', id)
    .maybeSingle()

  async function handleSaveBriefing(formData: FormData) {
    'use server'
    await updateBriefingAction(id, formData)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 antialiased">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/app/projetos/${id}`}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Ficha de Briefing & Programa
            </h1>
            <p className="text-xs text-slate-500">
              Projeto: <strong className="text-slate-800">{project.title}</strong> ({project.code})
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <form action={handleSaveBriefing} className="space-y-6">
          {/* Estilo & Inspirações */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" /> Preferências Estéticas & Inspirações
            </label>
            <p className="text-xs text-slate-500">
              Estilo arquitetônico preferido pelo cliente (Moderno, Contemporâneo, Minimalista, Rústico Chic, Industrial), paleta de materiais e referências visuais.
            </p>
            <textarea
              name="stylePreferences"
              rows={3}
              defaultValue={briefing?.style_preferences || ''}
              placeholder="Ex: Cliente busca arquitetura contemporânea com uso de concreto aparente, madeira cumaru e esquadrias pretas minimalistas..."
              className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Condicionantes do Terreno / Local */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" /> Condicionantes do Terreno / Edificação
            </label>
            <p className="text-xs text-slate-500">
              Topografia, orientação solar (norte/sul), ventilação predominante, recuos obrigatórios na prefeitura e vistas privilegiadas.
            </p>
            <textarea
              name="siteConditions"
              rows={3}
              defaultValue={briefing?.site_conditions || ''}
              placeholder="Ex: Terreno com declive suave de 2,5m. Fachada principal voltada para o Leste (sol da manhã). Vista panorâmica para a mata nos fundos..."
              className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Observações de Orçamento / Investimento */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-600" /> Expectativas de Orçamento & Prazos do Cliente
            </label>
            <p className="text-xs text-slate-500">
              Expectativas financeiras para a construção/reforma, prioridades de investimento e prazos ideais para início de obra.
            </p>
            <textarea
              name="budgetNotes"
              rows={3}
              defaultValue={briefing?.budget_notes || ''}
              placeholder="Ex: Teto orçamentário de R$ 900.000 para a obra civil. Prioridade em isolamento acústico na suíte master e energia solar fotovoltaica..."
              className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Notas Gerais de Reuniões */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Notas Gerais & Atas de Reunião
            </label>
            <p className="text-xs text-slate-500">
              Histórico de decisões tomadas em reuniões presenciais ou videoconferências com o cliente.
            </p>
            <textarea
              name="notes"
              rows={4}
              defaultValue={briefing?.notes || ''}
              placeholder="Ex: Reunião de 10/08: Cliente aprovou layout preliminar com integração total da cozinha à área gourmet..."
              className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href={`/app/projetos/${id}`}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              Voltar ao Hub
            </Link>

            <button
              type="submit"
              className="py-2.5 px-6 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Salvar Ficha de Briefing
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
