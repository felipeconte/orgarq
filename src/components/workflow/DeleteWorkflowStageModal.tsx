'use client'

import { useState, useEffect } from 'react'
import { Trash2, AlertTriangle, ArrowRight, Loader2, X } from 'lucide-react'
import {
  WorkflowStage,
  STAGE_COLOR_CONFIG,
  getStageConfig
} from '@/lib/workflow-stages'

export interface DeleteWorkflowStageModalProps {
  isOpen: boolean
  stageToDelete: WorkflowStage | null
  allStages: WorkflowStage[]
  tasksCount?: number
  isPending?: boolean
  onClose: () => void
  onConfirm: (stageId: string, fallbackStageId: string) => Promise<void> | void
}

export default function DeleteWorkflowStageModal({
  isOpen,
  stageToDelete,
  allStages,
  tasksCount = 0,
  isPending = false,
  onClose,
  onConfirm,
}: DeleteWorkflowStageModalProps) {
  const [selectedFallbackId, setSelectedFallbackId] = useState<string>('')

  const remainingStages = allStages.filter((s) => s.id !== stageToDelete?.id)

  useEffect(() => {
    if (remainingStages.length > 0) {
      setSelectedFallbackId(remainingStages[0].id)
    }
  }, [stageToDelete, allStages])

  if (!isOpen || !stageToDelete) return null

  const stageCfg = getStageConfig(stageToDelete.id, allStages).style

  const handleConfirm = () => {
    if (!selectedFallbackId && remainingStages.length > 0) {
      setSelectedFallbackId(remainingStages[0].id)
    }
    onConfirm(stageToDelete.id, selectedFallbackId || remainingStages[0]?.id || 'a_iniciar')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 antialiased">
      {/* Backdrop */}
      <div
        onClick={() => !isPending && onClose()}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Excluir Etapa
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold border ${stageCfg.badge}`}>
                  <span className={`w-2 h-2 rounded-full ${stageCfg.dot}`} />
                  {stageToDelete.name}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Body */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            Atenção com as tarefas desta etapa
          </div>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            {tasksCount > 0 ? (
              <>
                Existem <strong>{tasksCount} tarefa(s)</strong> vinculadas a esta etapa no momento.
              </>
            ) : (
              'As tarefas associadas a esta etapa no projeto precisam de um novo destino.'
            )}{' '}
            Defina abaixo para qual etapa elas serão transferidas automaticamente:
          </p>
        </div>

        {/* Destination Stage Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Mover tarefas vinculadas para: *
          </label>

          <div className="relative">
            <select
              value={selectedFallbackId}
              onChange={(e) => setSelectedFallbackId(e.target.value)}
              disabled={isPending}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              {remainingStages.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Visual Indicator of the transfer */}
          {selectedFallbackId && (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <span className="text-slate-500 text-[11px] font-semibold">Destino selecionado:</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                {remainingStages.find((s) => s.id === selectedFallbackId)?.name || 'Etapa selecionada'}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || remainingStages.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" /> Excluir e Mover Tarefas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
