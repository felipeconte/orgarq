'use client'

import React, { useState, useEffect, useRef, useTransition } from 'react'
import {
  Check,
  ChevronDown,
  Layers,
  Settings2,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react'
import { ProjectTypologyItem, DEFAULT_PROJECT_TYPOLOGIES } from '@/types/typologies'
import {
  getProjectTypologiesAction,
  createProjectTypologyAction,
  updateProjectTypologyAction,
  deleteProjectTypologyAction,
} from '@/lib/actions/project-typologies'

export interface TypologySelectProps {
  value: string
  onChange: (value: string) => void
  organizationId?: string
  name?: string
  disabled?: boolean
  className?: string
  onTypologiesChange?: (typologies: ProjectTypologyItem[]) => void
}

export default function TypologySelect({
  value,
  onChange,
  organizationId = '',
  name = 'typology',
  disabled = false,
  className = '',
  onTypologiesChange,
}: TypologySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'select' | 'manage'>('select')

  // Catálogo de tipologias
  const [typologies, setTypologies] = useState<ProjectTypologyItem[]>(() =>
    DEFAULT_PROJECT_TYPOLOGIES.map((t) => ({
      name: t,
      is_custom: false,
      project_count: 0,
    }))
  )
  const [loadingList, setLoadingList] = useState(false)

  // Adição
  const [newTypologyName, setNewTypologyName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Edição
  const [editingTypology, setEditingTypology] = useState<{
    id?: string
    oldName: string
    currentName: string
  } | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Exclusão com migração
  const [deletingTarget, setDeletingTarget] = useState<ProjectTypologyItem | null>(null)
  const [replacementTypology, setReplacementTypology] = useState<string>('')
  const [isMigratingAndDeleting, setIsMigratingAndDeleting] = useState(false)

  // Mensagens inline
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const newAddInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setMode('select')
        setEditingTypology(null)
        setDeletingTarget(null)
        setFeedback(null)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Foco no input de adição ou edição quando ativados
  useEffect(() => {
    if (mode === 'manage') {
      setTimeout(() => newAddInputRef.current?.focus(), 100)
    }
  }, [mode])

  useEffect(() => {
    if (editingTypology) {
      setTimeout(() => editInputRef.current?.focus(), 80)
    }
  }, [editingTypology])

  // Limpa feedback após 4 segundos
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Carrega tipologias do banco para a organização
  const fetchTypologies = async () => {
    if (!organizationId) return
    setLoadingList(true)
    try {
      const res = await getProjectTypologiesAction(organizationId)
      if (res.success && res.typologies && res.typologies.length > 0) {
        setTypologies(res.typologies)
        onTypologiesChange?.(res.typologies)
      }
    } catch (err) {
      console.warn('Erro ao buscar tipologias:', err)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (organizationId) {
      fetchTypologies()
    }
  }, [organizationId])

  // --- CRUD HANDLERS ---

  // 1. Adicionar Nova Tipologia
  const handleAddTypology = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newTypologyName.trim()
    if (!trimmed || trimmed.length < 2) {
      setFeedback({ type: 'error', text: 'Informe pelo menos 2 caracteres.' })
      return
    }

    const alreadyExists = typologies.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (alreadyExists) {
      setFeedback({ type: 'error', text: 'Esta tipologia já está cadastrada.' })
      return
    }

    setIsAdding(true)
    setFeedback(null)

    try {
      const res = await createProjectTypologyAction(organizationId, trimmed)
      if (res.success && res.typology) {
        const newCat = res.typology
        setTypologies((prev) => {
          const updated = [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          onTypologiesChange?.(updated)
          return updated
        })
        onChange(newCat.name)
        setNewTypologyName('')
        setFeedback({ type: 'success', text: `Tipologia "${newCat.name}" criada com sucesso!` })
      } else {
        setFeedback({ type: 'error', text: res.error || 'Erro ao adicionar tipologia.' })
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro inesperado ao cadastrar.' })
    } finally {
      setIsAdding(false)
    }
  }

  // 2. Iniciar e Salvar Edição / Renomeação
  const handleStartEdit = (t: ProjectTypologyItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTypology({
      id: t.id,
      oldName: t.name,
      currentName: t.name,
    })
    setDeletingTarget(null)
  }

  const handleSaveEdit = async () => {
    if (!editingTypology) return
    const cleanNew = editingTypology.currentName.trim()
    const old = editingTypology.oldName

    if (!cleanNew || cleanNew.length < 2) {
      setFeedback({ type: 'error', text: 'O nome deve ter pelo menos 2 caracteres.' })
      return
    }

    if (cleanNew.toLowerCase() === old.toLowerCase()) {
      setEditingTypology(null)
      return
    }

    const collision = typologies.some(
      (t) => t.name.toLowerCase() === cleanNew.toLowerCase() && t.name.toLowerCase() !== old.toLowerCase()
    )
    if (collision) {
      setFeedback({ type: 'error', text: 'Já existe outra tipologia com esse nome.' })
      return
    }

    setIsSavingEdit(true)
    setFeedback(null)

    try {
      const res = await updateProjectTypologyAction(
        organizationId,
        old,
        cleanNew,
        editingTypology.id
      )
      if (res.success) {
        setTypologies((prev) => {
          const updated = prev
            .map((t) => (t.name === old ? { ...t, name: cleanNew } : t))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          onTypologiesChange?.(updated)
          return updated
        })

        // Se o valor atualmente selecionado no form era a antiga tipologia, atualiza para a nova (case-insensitive)
        if (value.trim().toLowerCase() === old.trim().toLowerCase()) {
          onChange(cleanNew)
        }

        fetchTypologies()

        const countMsg = res.countUpdated ? ` e ${res.countUpdated} projeto(s) atualizados` : ''
        setFeedback({
          type: 'success',
          text: `Tipologia renomeada com sucesso${countMsg}!`,
        })
        setEditingTypology(null)
      } else {
        setFeedback({ type: 'error', text: res.error || 'Erro ao renomear tipologia.' })
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro inesperado ao renomear.' })
    } finally {
      setIsSavingEdit(false)
    }
  }

  // 3. Iniciar e Confirmar Exclusão com Migração Obrigatória
  const handleStartDelete = (t: ProjectTypologyItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingTarget(t)
    setEditingTypology(null)

    // Pré-seleciona a primeira outra tipologia disponível como substituta
    const alternative = typologies.find((item) => item.name.trim().toLowerCase() !== t.name.trim().toLowerCase())
    setReplacementTypology(alternative ? alternative.name : '')
  }

  const handleConfirmDeleteAndMigrate = async () => {
    if (!deletingTarget) return

    if (!replacementTypology) {
      setFeedback({
        type: 'error',
        text: 'Por favor, selecione para qual tipologia os projetos devem ser transferidos.',
      })
      return
    }

    if (replacementTypology.trim().toLowerCase() === deletingTarget.name.trim().toLowerCase()) {
      setFeedback({
        type: 'error',
        text: 'A tipologia de destino deve ser diferente da que está sendo excluída.',
      })
      return
    }

    setIsMigratingAndDeleting(true)
    setFeedback(null)

    try {
      const res = await deleteProjectTypologyAction(
        organizationId,
        deletingTarget.name,
        replacementTypology,
        deletingTarget.id
      )

      if (res.success) {
        const deletedLower = deletingTarget.name.trim().toLowerCase()
        const deletedDisplay = deletingTarget.name

        setTypologies((prev) => {
          const updated = prev.filter((t) => t.name.trim().toLowerCase() !== deletedLower)
          onTypologiesChange?.(updated)
          return updated
        })

        // Se a tipologia excluída era a atualmente selecionada no form, muda para a substituta (case-insensitive)
        if (value.trim().toLowerCase() === deletedLower) {
          onChange(replacementTypology)
        }

        // Re-sincroniza do banco de dados imediatamente
        fetchTypologies()

        const countMsg = res.countMigrated
          ? ` (${res.countMigrated} projeto(s) transferidos para "${replacementTypology}")`
          : ''
        setFeedback({
          type: 'success',
          text: `Tipologia "${deletedDisplay}" excluída com sucesso${countMsg}!`,
        })
        setDeletingTarget(null)
      } else {
        setFeedback({ type: 'error', text: res.error || 'Erro ao excluir tipologia.' })
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro inesperado ao excluir.' })
    } finally {
      setIsMigratingAndDeleting(false)
    }
  }

  // Nome formatado para exibição no botão gatilho
  const matchedTypology = typologies.find(
    (t) => t.name.trim().toLowerCase() === (value || '').trim().toLowerCase()
  )
  const displayValue = matchedTypology ? matchedTypology.name : value

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Campo Oculto para Formulários Tradicionais com FormData */}
      <input type="hidden" name={name} value={value} />

      {/* Botão Gatilho do Dropdown */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev)
            if (!isOpen) {
              setMode('select')
              setDeletingTarget(null)
              setEditingTypology(null)
            }
          }
        }}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 transition-all text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-300'
          } ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-600' : ''}`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="truncate font-semibold text-slate-800">
            {displayValue || 'Selecione a Tipologia'}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden min-w-full w-[330px] sm:w-[360px] max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-150">
          {/* Alerta / Feedback Inline */}
          {feedback && (
            <div
              className={`p-2.5 px-3 text-xs font-semibold flex items-center justify-between border-b ${feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                  : 'bg-rose-50 text-rose-800 border-rose-100'
                }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${feedback.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                />
                <span className="truncate">{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="p-0.5 hover:bg-black/5 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* MODO 1: SELEÇÃO RÁPIDA */}
          {mode === 'select' && (
            <div className="p-1.5">
              <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Tipologia do Projeto</span>
                {loadingList && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 py-1 pr-0.5">
                {typologies.map((t) => {
                  const isSelected = (value || '').trim().toLowerCase() === t.name.trim().toLowerCase()
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        onChange(t.name)
                        setIsOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all cursor-pointer text-left ${isSelected
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="truncate">{t.name}</span>
                        {t.project_count !== undefined && t.project_count > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${isSelected
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-500'
                              }`}
                            title={`${t.project_count} projeto(s) com esta tipologia`}
                          >
                            {t.project_count} {t.project_count === 1 ? 'proj.' : 'projs.'}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                    </button>
                  )
                })}
              </div>

              {/* Rodapé: Botão de Alternar para o Modo Gerenciar */}
              <div className="pt-1.5 mt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMode('manage')
                    setFeedback(null)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 rounded-xl transition-all cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                  Gerenciar
                </button>
              </div>
            </div>
          )}

          {/* MODO 2: GERENCIAMENTO (CRUD INTEGRADO NO DROPDOWN) */}
          {mode === 'manage' && (
            <div className="p-2 space-y-2.5">
              {/* Topo do Gerenciador: Voltar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 px-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('select')
                    setDeletingTarget(null)
                    setEditingTypology(null)
                    setFeedback(null)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Gestão de Tipologias
                </span>
              </div>

              {/* Sub-painel: Diálogo de Confirmação de Exclusão & Migração de Projetos */}
              {deletingTarget ? (
                <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200/80 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-start gap-2.5 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">
                        Excluir &ldquo;{deletingTarget.name}&rdquo;?
                      </p>
                      <p className="text-[11px] text-rose-700 mt-1 leading-snug">
                        {deletingTarget.project_count && deletingTarget.project_count > 0 ? (
                          <>
                            Existem <strong>{deletingTarget.project_count} projeto(s)</strong> com
                            esta tipologia. Para manter o sistema íntegro, selecione para qual
                            outra tipologia eles serão transferidos:
                          </>
                        ) : (
                          <>Selecione para qual tipologia substituta migrar eventuais registros:</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Seletor da Tipologia Substituta */}
                  <div>
                    <label className="block text-[11px] font-bold text-rose-900 uppercase tracking-wider mb-1">
                      Transferir projetos para:
                    </label>
                    <select
                      value={replacementTypology}
                      disabled={isMigratingAndDeleting}
                      onChange={(e) => setReplacementTypology(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-rose-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500"
                    >
                      {typologies
                        .filter(
                          (t) =>
                            t.name.trim().toLowerCase() !== deletingTarget.name.trim().toLowerCase()
                        )
                        .map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Ações de Confirmação */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isMigratingAndDeleting}
                      onClick={() => setDeletingTarget(null)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isMigratingAndDeleting}
                      onClick={handleConfirmDeleteAndMigrate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {isMigratingAndDeleting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Migrando...</span>
                        </>
                      ) : (
                        <span>Transferir e Excluir</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Formulário Compacto para Adicionar Nova Tipologia */
                <form onSubmit={handleAddTypology} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      ref={newAddInputRef}
                      type="text"
                      placeholder="Nova tipologia (ex: Hospitalar)..."
                      value={newTypologyName}
                      disabled={isAdding}
                      onChange={(e) => setNewTypologyName(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={isAdding || !newTypologyName.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                    >
                      {isAdding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Adicionar</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Lista de Tipologias com Opções de Editar e Excluir */}
              <div className="max-h-52 overflow-y-auto space-y-1 py-1">
                {typologies.map((t) => {
                  const isBeingEdited = editingTypology?.oldName === t.name

                  // Linha em Modo de Edição Inline
                  if (isBeingEdited) {
                    return (
                      <div
                        key={t.name}
                        className="flex items-center gap-1.5 p-1 bg-blue-50/50 border border-blue-300 rounded-xl"
                      >
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingTypology.currentName}
                          disabled={isSavingEdit}
                          onChange={(e) =>
                            setEditingTypology({
                              ...editingTypology,
                              currentName: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSaveEdit()
                            } else if (e.key === 'Escape') {
                              setEditingTypology(null)
                            }
                          }}
                          className="flex-1 min-w-0 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          disabled={isSavingEdit}
                          onClick={handleSaveEdit}
                          className="p-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Salvar e atualizar projetos"
                        >
                          {isSavingEdit ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingEdit}
                          onClick={() => setEditingTypology(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer shrink-0"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  }

                  // Linha Normal
                  return (
                    <div
                      key={t.name}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50/60 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all group gap-2"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <span className="text-xs font-semibold text-slate-700 truncate">
                          {t.name}
                        </span>
                        {t.project_count !== undefined && t.project_count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-slate-200/70 text-slate-600 shrink-0 whitespace-nowrap">
                            {t.project_count} {t.project_count === 1 ? 'proj.' : 'projs.'}
                          </span>
                        )}
                      </div>

                      {/* Ações de Edição e Exclusão */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(t, e)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Renomear tipologia (atualiza projetos existentes)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Botão de Excluir só aparece se houver mais de 1 tipologia no sistema */}
                        {typologies.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleStartDelete(t, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir tipologia e transferir projetos"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
