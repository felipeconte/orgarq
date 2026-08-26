'use client'

import { useState } from 'react'
import {
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
  Layers,
  FileCheck,
  Building2,
  Plus,
  Copy,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Check,
  Loader2,
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import {
  createTemplateAction,
  updateTemplateAction,
  setDefaultTemplateAction,
  deleteTemplateAction,
  addTemplateItemAction,
  updateTemplateItemAction,
  deleteTemplateItemAction,
  reorderTemplateItemsAction
} from '@/lib/actions/templates'

export interface TemplateItemData {
  id: string
  stage_template_id: string
  name: string
  description: string | null
  stage_order: number
  default_duration_days: number | null
  is_client_approval_required: boolean
}

export interface TemplateData {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_default: boolean
  stage_template_items: TemplateItemData[]
}

export interface StageTemplatesManagerProps {
  initialTemplates: TemplateData[]
}

export default function StageTemplatesManager({
  initialTemplates,
}: StageTemplatesManagerProps) {
  const [templates, setTemplates] = useState<TemplateData[]>(initialTemplates)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplates.find((t) => t.is_default)?.id || initialTemplates[0]?.id || ''
  )

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDesc, setNewTemplateDesc] = useState('')
  const [duplicateFromId, setDuplicateFromId] = useState('')

  const [showEditTplModal, setShowEditTplModal] = useState(false)
  const [editTplName, setEditTplName] = useState('')
  const [editTplDesc, setEditTplDesc] = useState('')

  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<TemplateItemData | null>(null)
  const [itemForm, setItemForm] = useState<{
    name: string
    description: string
    default_duration_days: number | ''
    is_client_approval_required: boolean
  }>({
    name: '',
    description: '',
    default_duration_days: '',
    is_client_approval_required: true,
  })

  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const currentTemplate =
    templates.find((t) => t.id === selectedTemplateId) || templates[0]

  const items = currentTemplate?.stage_template_items
    ? [...currentTemplate.stage_template_items].sort((a, b) => a.stage_order - b.stage_order)
    : []

  const totalDuration = items.reduce((acc, i) => acc + (i.default_duration_days || 0), 0)
  const approvalCount = items.filter((i) => i.is_client_approval_required).length

  const showNotification = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  // CREATE TEMPLATE
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTemplateName.trim()) return

    setLoading(true)
    const res = await createTemplateAction(
      newTemplateName,
      newTemplateDesc,
      duplicateFromId || undefined
    )
    setLoading(false)

    if (res.success && res.templateId) {
      const duplicatedSource = templates.find((t) => t.id === duplicateFromId)
      const clonedItems: TemplateItemData[] = duplicatedSource
        ? duplicatedSource.stage_template_items.map((i, idx) => ({
          ...i,
          id: `temp-${Date.now()}-${idx}`,
          stage_template_id: res.templateId!,
        }))
        : []

      const newTpl: TemplateData = {
        id: res.templateId,
        organization_id: currentTemplate?.organization_id || '',
        name: newTemplateName.trim(),
        description: newTemplateDesc.trim() || null,
        is_default: false,
        stage_template_items: clonedItems,
      }

      setTemplates([...templates, newTpl])
      setSelectedTemplateId(res.templateId)
      setShowCreateModal(false)
      setNewTemplateName('')
      setNewTemplateDesc('')
      setDuplicateFromId('')
      showNotification('Novo template criado com sucesso!')
    }
  }

  // SET AS DEFAULT
  const handleSetDefault = async (templateId: string) => {
    setLoading(true)
    const res = await setDefaultTemplateAction(templateId)
    setLoading(false)

    if (res.success) {
      setTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          is_default: t.id === templateId,
        }))
      )
      showNotification('Template definido como padrão oficial para novos projetos!')
    }
  }

  // EDIT TEMPLATE
  const handleOpenEditTpl = () => {
    if (!currentTemplate) return
    setEditTplName(currentTemplate.name)
    setEditTplDesc(currentTemplate.description || '')
    setShowEditTplModal(true)
  }

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentTemplate || !editTplName.trim()) return

    setLoading(true)
    const res = await updateTemplateAction(currentTemplate.id, editTplName, editTplDesc)
    setLoading(false)

    if (res.success) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === currentTemplate.id
            ? { ...t, name: editTplName.trim(), description: editTplDesc.trim() || null }
            : t
        )
      )
      setShowEditTplModal(false)
      showNotification('Template atualizado com sucesso!')
    }
  }

  // DELETE TEMPLATE
  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      setLoading(true)
      const res = await deleteTemplateAction(templateId)
      setLoading(false)

      if (res.success) {
        const remaining = templates.filter((t) => t.id !== templateId)
        setTemplates(remaining)
        setSelectedTemplateId(remaining[0]?.id || '')
        showNotification('Template removido com sucesso!')
      } else {
        alert(res.error)
      }
    }
  }

  // ADD / EDIT TASK ITEM
  const handleOpenItemModal = (item?: TemplateItemData) => {
    if (item) {
      setEditingItem(item)
      setItemForm({
        name: item.name,
        description: item.description || '',
        default_duration_days: item.default_duration_days != null ? item.default_duration_days : '',
        is_client_approval_required: item.is_client_approval_required,
      })
    } else {
      setEditingItem(null)
      setItemForm({
        name: '',
        description: '',
        default_duration_days: '',
        is_client_approval_required: true,
      })
    }
    setShowItemModal(true)
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentTemplate || !itemForm.name.trim()) return

    setLoading(true)
    const durationValue =
      itemForm.default_duration_days !== '' && !isNaN(Number(itemForm.default_duration_days))
        ? Number(itemForm.default_duration_days)
        : null

    if (editingItem) {
      const res = await updateTemplateItemAction(editingItem.id, {
        name: itemForm.name,
        description: itemForm.description,
        default_duration_days: durationValue,
        is_client_approval_required: itemForm.is_client_approval_required,
      })
      setLoading(false)

      if (res.success) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === currentTemplate.id
              ? {
                ...t,
                stage_template_items: t.stage_template_items.map((i) =>
                  i.id === editingItem.id
                    ? {
                      ...i,
                      name: itemForm.name,
                      description: itemForm.description,
                      default_duration_days: durationValue,
                      is_client_approval_required: itemForm.is_client_approval_required,
                    }
                    : i
                ),
              }
              : t
          )
        )
        setShowItemModal(false)
        showNotification('Tarefa atualizada!')
      }
    } else {
      const res = await addTemplateItemAction(currentTemplate.id, {
        name: itemForm.name,
        description: itemForm.description,
        default_duration_days: durationValue,
        is_client_approval_required: itemForm.is_client_approval_required,
      })
      setLoading(false)

      if (res.success && res.item) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === currentTemplate.id
              ? {
                ...t,
                stage_template_items: [...t.stage_template_items, res.item!],
              }
              : t
          )
        )
        setShowItemModal(false)
        showNotification('Nova tarefa adicionada ao template!')
      }
    }
  }

  // DELETE TASK ITEM
  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Deseja excluir esta tarefa do template?')) {
      setLoading(true)
      const res = await deleteTemplateItemAction(itemId)
      setLoading(false)

      if (res.success && currentTemplate) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === currentTemplate.id
              ? {
                ...t,
                stage_template_items: t.stage_template_items.filter((i) => i.id !== itemId),
              }
              : t
          )
        )
        showNotification('Tarefa excluída!')
      }
    }
  }

  // REORDER TASK ITEMS (UP / DOWN)
  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    if (!currentTemplate) return
    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newItems.length) return

    const temp = newItems[index]
    newItems[index] = newItems[targetIndex]
    newItems[targetIndex] = temp

    const orderedIds = newItems.map((i) => i.id)

    setTemplates((prev) =>
      prev.map((t) =>
        t.id === currentTemplate.id
          ? {
            ...t,
            stage_template_items: newItems.map((item, idx) => ({
              ...item,
              stage_order: idx + 1,
            })),
          }
          : t
      )
    )

    await reorderTemplateItemsAction(currentTemplate.id, orderedIds)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 antialiased">
      {/* Toast Notification */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <SlidersHorizontal className="w-6 h-6 text-blue-600" /> Templates de Tarefas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure os padrões de tarefas do escritório. Todo novo projeto cadastrado clonará a estrutura do template padrão ativo.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      {/* Templates Tabs Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => setSelectedTemplateId(tpl.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${selectedTemplateId === tpl.id
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{tpl.name}</span>
            {tpl.is_default && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${selectedTemplateId === tpl.id
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
              >
                Padrão Ativo
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active Template Card */}
      {currentTemplate ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          {/* Header of Active Template */}
          <div className="p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900">{currentTemplate.name}</h3>
                {currentTemplate.is_default ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Template Ativo para Novos Projetos
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetDefault(currentTemplate.id)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Check className="w-3 h-3 text-blue-600" /> Definir como Padrão
                  </button>
                )}
              </div>
              {currentTemplate.description && (
                <p className="text-xs text-slate-500">{currentTemplate.description}</p>
              )}
            </div>

            {/* Template Actions (Edit, Duplicate, Delete, Add Task) */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenEditTpl}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                title="Editar informações do template"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setDuplicateFromId(currentTemplate.id)
                  setNewTemplateName(`${currentTemplate.name} (Cópia)`)
                  setShowCreateModal(true)
                }}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                title="Duplicar template"
              >
                <Copy className="w-4 h-4" />
              </button>

              {!currentTemplate.is_default && (
                <button
                  onClick={() => handleDeleteTemplate(currentTemplate.id)}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer"
                  title="Excluir template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => handleOpenItemModal()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer ml-2"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-6 py-2 flex items-center gap-6 text-xs text-slate-600 font-semibold border-b border-slate-100">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" /> {items.length} Tarefas Configuradas
            </span>
            {totalDuration > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> ~{totalDuration} dias previstos
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> {approvalCount} com Aprovação de Cliente
            </span>
          </div>

          {/* Task Items List */}
          <div className="p-3 divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">Nenhuma tarefa neste template</p>
                <p className="text-xs text-slate-400">Clique no botão "Adicionar Tarefa" para começar a montar o fluxo.</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors rounded-xl group"
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    <span className="font-mono text-xs font-extrabold text-blue-600 bg-blue-50/80 border border-blue-100 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      {item.stage_order < 10 ? `0${item.stage_order}` : item.stage_order}
                    </span>
                    <div className="space-y-0.5">
                      <span className="text-sm font-bold text-slate-900 block">{item.name}</span>
                      {item.description && (
                        <p className="text-xs text-slate-500">{item.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Metadata & Controls */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0 pl-11 sm:pl-0">
                    {item.default_duration_days != null && item.default_duration_days > 0 ? (
                      <span className="text-slate-500 font-mono text-xs bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
                        ⏱️ {item.default_duration_days} dias
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-[11px]">
                        Sem prazo fixo
                      </span>
                    )}

                    {item.is_client_approval_required ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Aprovação Cliente
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        Interno
                      </span>
                    )}

                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveItem(idx, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer"
                        title="Subir ordem"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === items.length - 1}
                        onClick={() => handleMoveItem(idx, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer"
                        title="Descer ordem"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Edit & Delete Task Buttons */}
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                      <button
                        onClick={() => handleOpenItemModal(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar tarefa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir tarefa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-sm font-semibold text-slate-700">Nenhum template cadastrado.</p>
        </div>
      )}

      {/* MODAL: NOVO TEMPLATE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowCreateModal(false)} />
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl z-10 space-y-4 border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">Novo Template de Tarefas</h3>

            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Template</label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Ex: Projeto Comercial Express, Reforma de Interiores..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="Finalidade e orientações sobre este fluxo..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Copiar tarefas de:</label>
                <select
                  value={duplicateFromId}
                  onChange={(e) => setDuplicateFromId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500 bg-white"
                >
                  <option value="">Iniciar template vazio</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.stage_template_items?.length || 0} tarefas)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !newTemplateName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR TEMPLATE */}
      {showEditTplModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowEditTplModal(false)} />
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl z-10 space-y-4 border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">Editar Template</h3>

            <form onSubmit={handleUpdateTemplate} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Template</label>
                <input
                  type="text"
                  required
                  value={editTplName}
                  onChange={(e) => setEditTplName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={editTplDesc}
                  onChange={(e) => setEditTplDesc(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditTplModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !editTplName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR / EDITAR TAREFA */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowItemModal(false)} />
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl z-10 space-y-4 border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">
              {editingItem ? 'Editar Tarefa do Template' : 'Nova Tarefa no Template'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome da Tarefa</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="Ex: 03. Estudo Preliminar, Projeto Executivo..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descrição / Instruções</label>
                <textarea
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Orientações e o que deve ser entregue..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Duração Sugerida (dias) <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={itemForm.default_duration_days}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        default_duration_days: e.target.value === '' ? '' : parseInt(e.target.value) || '',
                      })
                    }
                    placeholder="Vazio (sem prazo)"
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Aprovação do Cliente</label>
                  <button
                    type="button"
                    onClick={() =>
                      setItemForm({
                        ...itemForm,
                        is_client_approval_required: !itemForm.is_client_approval_required,
                      })
                    }
                    className={`w-full text-xs font-bold py-2.5 px-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${itemForm.is_client_approval_required
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                  >
                    <span>{itemForm.is_client_approval_required ? 'Requer Aceite' : 'Interno'}</span>
                    <FileCheck className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !itemForm.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Adicionar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
