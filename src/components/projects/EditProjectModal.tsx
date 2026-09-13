'use client'

import React, { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  FolderGit2,
  Compass,
  Calendar,
  DollarSign,
  Search,
  MapPin,
  X,
  Loader2,
  Check,
  Copy,
} from 'lucide-react'
import { updateProjectAction } from '@/lib/actions/projects'
import { ClientData } from '@/lib/actions/clients'
import ClientMultiSelect from '@/components/projects/ClientMultiSelect'
import TypologySelect from '@/components/projects/TypologySelect'
import { ProjectItem } from '@/components/projects/ProjectsManagerClient'
import { formatAreaOnlyNumbers } from '@/lib/formatters-and-validators'

const ProjectLocationMap = dynamic(
  () => import('./ProjectLocationMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-600" /> Carregando mapa...
      </div>
    ),
  }
)

interface NominatimPlace {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    road?: string
    pedestrian?: string
    street?: string
    house_number?: string
    suburb?: string
    neighbourhood?: string
    quarter?: string
    city?: string
    town?: string
    municipality?: string
    village?: string
    state?: string
    postcode?: string
  }
}

function formatCurrencyBRL(value: string | number): { formatted: string; raw: number } {
  let raw = 0

  if (typeof value === 'number') {
    raw = value
  } else {
    const cleanNumber = value.replace(/\D/g, '')
    if (!cleanNumber) return { formatted: '', raw: 0 }
    raw = parseFloat(cleanNumber) / 100
  }

  if (isNaN(raw) || raw < 0) return { formatted: '', raw: 0 }

  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(raw)

  return { formatted, raw }
}

export interface EditProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project: ProjectItem | null
  clients?: ClientData[]
  organizationId: string
  onSaved?: (updatedProject: ProjectItem) => void
}

export default function EditProjectModal({
  isOpen,
  onClose,
  project,
  clients = [],
  organizationId,
  onSaved,
}: EditProjectModalProps) {
  const [editTitle, setEditTitle] = useState('')
  const [editStatus, setEditStatus] = useState('ativo')
  const [editTypology, setEditTypology] = useState('Residencial')
  const [editAreaInput, setEditAreaInput] = useState('')
  const [editAreaRaw, setEditAreaRaw] = useState<number | null>(null)
  const [editBudgetInput, setEditBudgetInput] = useState('')
  const [editBudgetRaw, setEditBudgetRaw] = useState<number | null>(null)
  const [editClientIds, setEditClientIds] = useState<string[]>([])
  const [editClientError, setEditClientError] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  // Endereço e Localização
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimPlace[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [addressRoad, setAddressRoad] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [addressComplement, setAddressComplement] = useState('')
  const [addressNeighborhood, setAddressNeighborhood] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressState, setAddressState] = useState('')
  const [addressPostalCode, setAddressPostalCode] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Inicializa dados quando o projeto ou o modal abrem
  useEffect(() => {
    if (isOpen && project) {
      setEditTitle(project.title || '')
      setEditStatus(project.status || 'ativo')
      setEditTypology(project.typology || 'Residencial')
      setEditAreaInput(
        project.area_sqm !== null && project.area_sqm !== undefined
          ? formatAreaOnlyNumbers(project.area_sqm).display
          : ''
      )
      setEditAreaRaw(project.area_sqm || null)
      const budgetNum =
        project.estimated_budget !== null && project.estimated_budget !== undefined
          ? Number(project.estimated_budget)
          : null

      if (budgetNum !== null && !isNaN(budgetNum) && budgetNum > 0) {
        setEditBudgetInput(formatCurrencyBRL(budgetNum).formatted)
        setEditBudgetRaw(budgetNum)
      } else {
        setEditBudgetInput('')
        setEditBudgetRaw(null)
      }
      setEditClientIds(
        project.client_ids || (project.client_id ? [project.client_id] : [])
      )
      setEditClientError(null)
      setEditStartDate(project.start_date || '')
      setEditDeadline(project.deadline || '')
      setEditDescription(project.description || '')
      setCopiedCode(false)
      setSearchQuery('')
      setAddressSuggestions([])
      setShowSuggestions(false)
      setErrorMsg(null)

      // Parse coordenadas e partes do endereço
      let rawAddress = project.address || ''
      const coordMatch = rawAddress.match(/\(Coordenadas:\s*([-\d.]+)[,\s]+([-\d.]+)\)/i)
      if (coordMatch) {
        setLat(parseFloat(coordMatch[1]))
        setLng(parseFloat(coordMatch[2]))
        rawAddress = rawAddress.replace(coordMatch[0], '').trim().replace(/-\s*$/, '').trim()
      } else {
        setLat(null)
        setLng(null)
      }

      const cepMatch = rawAddress.match(/CEP:\s*([\d-]+)/i)
      if (cepMatch) {
        setAddressPostalCode(cepMatch[1])
        rawAddress = rawAddress.replace(cepMatch[0], '').trim().replace(/-\s*$/, '').trim()
      } else {
        setAddressPostalCode('')
      }

      const bairroMatch = rawAddress.match(/Bairro:\s*([^ -]+)/i)
      if (bairroMatch) {
        setAddressNeighborhood(bairroMatch[1])
        rawAddress = rawAddress.replace(bairroMatch[0], '').trim().replace(/-\s*$/, '').trim()
      } else {
        setAddressNeighborhood('')
      }

      const numMatch = rawAddress.match(/Nº\s*([^\s,]+)/i)
      if (numMatch) {
        setAddressNumber(numMatch[1])
        rawAddress = rawAddress.replace(numMatch[0], '').trim()
      } else {
        setAddressNumber('')
      }

      const cleanRoad = rawAddress
        .replace(/^,\s*/, '')
        .replace(/,\s*$/, '')
        .replace(/\s*-\s*$/, '')
        .trim()
      setAddressRoad(cleanRoad)
      setAddressCity(project.city || '')
      setAddressState(project.state || '')
    }
  }, [isOpen, project])

  // Fecha dropdown de busca ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Trava scroll de fundo quando modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  const handleBudgetChange = (val: string) => {
    const digits = val.replace(/\D/g, '')
    if (!digits) {
      setEditBudgetInput('')
      setEditBudgetRaw(null)
      return
    }
    const { formatted, raw } = formatCurrencyBRL(digits)
    setEditBudgetInput(formatted)
    setEditBudgetRaw(raw)
  }

  const handleAreaChange = (val: string) => {
    const { display, raw } = formatAreaOnlyNumbers(val, editAreaInput)
    setEditAreaInput(display)
    setEditAreaRaw(raw)
  }

  const handleCopyCode = () => {
    if (!project?.code) return
    navigator.clipboard.writeText(project.code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleLocationChange = (newLat: number, newLng: number) => {
    setLat(newLat)
    setLng(newLng)
  }

  const handleAddressSearchChange = (query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!query || query.trim().length < 3) {
      setAddressSuggestions([])
      setShowSuggestions(false)
      setIsSearchingAddress(false)
      return
    }

    setIsSearchingAddress(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address/search?q=${encodeURIComponent(query.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setAddressSuggestions(data || [])
          setShowSuggestions(data && data.length > 0)
        }
      } catch (err) {
        console.error('Erro ao buscar endereço:', err)
      } finally {
        setIsSearchingAddress(false)
      }
    }, 400)
  }

  const handleSelectSuggestion = (place: NominatimPlace) => {
    const road =
      place.address?.road || place.address?.pedestrian || place.address?.street || ''
    const number = place.address?.house_number || ''
    const neighborhood =
      place.address?.suburb ||
      place.address?.neighbourhood ||
      place.address?.quarter ||
      ''
    const cityVal =
      place.address?.city ||
      place.address?.town ||
      place.address?.municipality ||
      place.address?.village ||
      ''
    const stateVal = place.address?.state || ''
    const postalCodeVal = place.address?.postcode || ''

    setAddressRoad(road || place.display_name.split(',')[0])
    setAddressNumber(number)
    setAddressNeighborhood(neighborhood)
    setAddressCity(cityVal)
    setAddressState(stateVal)
    setAddressPostalCode(postalCodeVal)
    setLat(parseFloat(place.lat))
    setLng(parseFloat(place.lon))
    setShowSuggestions(false)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project || !editTitle.trim()) return

    if (editClientIds.length === 0) {
      setEditClientError('Selecione ao menos um cliente cadastrado para o projeto.')
      return
    }

    setEditClientError(null)
    setLoading(true)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('title', editTitle.trim())
    editClientIds.forEach((cid) => formData.append('clientIds', cid))
    formData.append('typology', editTypology)
    if (editAreaRaw !== null) formData.append('areaSqm', editAreaRaw.toString())
    if (editBudgetRaw !== null) formData.append('estimatedBudget', editBudgetRaw.toString())
    formData.append('startDate', editStartDate)
    formData.append('deadline', editDeadline)
    formData.append('status', editStatus)
    formData.append('description', editDescription.trim())

    // Agrega detalhes completos de endereço e coordenadas
    const addressMain = [
      addressRoad.trim(),
      addressNumber.trim() ? `Nº ${addressNumber.trim()}` : '',
      addressComplement.trim() ? addressComplement.trim() : '',
    ]
      .filter(Boolean)
      .join(', ')

    const fullAddress = [
      addressMain,
      addressNeighborhood.trim() ? `Bairro: ${addressNeighborhood.trim()}` : '',
      addressPostalCode.trim() ? `CEP: ${addressPostalCode.trim()}` : '',
      lat && lng ? `(Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)})` : '',
    ]
      .filter(Boolean)
      .join(' - ')

    if (fullAddress) {
      formData.append('address', fullAddress)
    }
    if (addressCity.trim()) {
      formData.append('city', addressCity.trim())
    }
    if (addressState.trim()) {
      formData.append('state', addressState.trim())
    }

    try {
      const res = await updateProjectAction(project.id, formData)
      setLoading(false)

      if (res.success) {
        const linkedClients = clients.filter((c) => editClientIds.includes(c.id))
        const updatedClientName =
          linkedClients.length > 0
            ? linkedClients.map((c) => c.name).join(', ')
            : project.client_name
        const updatedClientEmail = linkedClients[0]?.email || null
        const updatedClientPhone = linkedClients[0]?.phone || null

        const updatedProject: ProjectItem = {
          ...project,
          title: editTitle.trim(),
          client_name: updatedClientName,
          client_email: updatedClientEmail,
          client_phone: updatedClientPhone,
          client_ids: editClientIds,
          typology: editTypology,
          area_sqm: editAreaRaw,
          estimated_budget: editBudgetRaw,
          start_date: editStartDate || null,
          deadline: editDeadline || null,
          status: editStatus,
          description: editDescription.trim() || null,
          address: fullAddress || null,
          city: addressCity.trim() || null,
          state: addressState.trim() || null,
        }

        onSaved?.(updatedProject)
        onClose()
      } else {
        setErrorMsg(res.error || 'Erro ao atualizar dados do projeto.')
      }
    } catch (err: any) {
      setLoading(false)
      setErrorMsg(err?.message || 'Erro inesperado ao salvar alterações.')
    }
  }

  if (!isOpen || !project) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-slate-200/80 text-slate-700 rounded-md">
                {project.code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {copiedCode ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Copiado!
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </span>
                )}
              </button>
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Editar Dados do Projeto
            </h3>
            <p className="text-sm text-slate-500">
              Atualize as informações cadastrais, contato do cliente e localização da obra.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSaveEdit} className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Section 1: Identificação */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <FolderGit2 className="w-4 h-4 text-blue-600" /> Identificação do Projeto
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Título do Projeto *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ex: Residência Alphaville ou Escritório Advocacia"
                  className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Status do Projeto
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                >
                  <option value="ativo">🟢 Ativo</option>
                  <option value="em_producao">⚡ Em Andamento</option>
                  <option value="pausado">🟡 Pausado</option>
                  <option value="concluido">✅ Concluído</option>
                  <option value="cancelado">🔴 Cancelado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Tipologia
                </label>
                <TypologySelect
                  value={editTypology}
                  onChange={setEditTypology}
                  organizationId={project.organization_id || organizationId}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Área do Projeto
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Compass className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editAreaInput}
                    onChange={(e) => handleAreaChange(e.target.value)}
                    onBlur={() => {
                      if (editAreaInput.endsWith(',')) {
                        setEditAreaInput(editAreaInput.slice(0, -1))
                      }
                    }}
                    placeholder="0"
                    className="block w-full pl-9 pr-12 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-xs font-bold text-slate-400 select-none bg-slate-100/80 px-2 py-0.5 rounded-md">
                      m²
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Orçamento Estimado (R$)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={editBudgetInput}
                    onChange={(e) => handleBudgetChange(e.target.value)}
                    placeholder="R$ 850.000,00"
                    className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Vínculo de Clientes (Multi-Clientes) */}
          <div className="pt-4 border-t border-slate-100">
            <ClientMultiSelect
              clients={clients}
              selectedClientIds={editClientIds}
              onChange={(ids) => {
                setEditClientIds(ids)
                if (ids.length > 0) setEditClientError(null)
              }}
              organizationId={organizationId}
              error={editClientError}
              required
            />
          </div>

          {/* Section 3: Cronograma & Localização */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-blue-600" /> Cronograma & Localização do Projeto
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Prazo Final Estimado
                </label>
                <input
                  type="date"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Busca Global de Endereço */}
            <div className="space-y-3">
              <div ref={searchContainerRef} className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Buscar Endereço
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    {isSearchingAddress ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleAddressSearchChange(e.target.value)}
                    onFocus={() => {
                      if (addressSuggestions.length > 0) setShowSuggestions(true)
                    }}
                    placeholder="Digite rua, avenida, condomínio ou cidade para autocompletar..."
                    className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-30 max-h-60 overflow-y-auto">
                    {addressSuggestions.map((place) => (
                      <button
                        key={place.place_id}
                        type="button"
                        onClick={() => handleSelectSuggestion(place)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-start gap-2.5 transition-colors cursor-pointer"
                      >
                        <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="truncate">
                          <span className="text-sm font-semibold text-slate-800 block truncate">
                            {place.display_name}
                          </span>
                          <span className="text-xs text-slate-400 block">
                            Lat: {parseFloat(place.lat).toFixed(4)}, Long: {parseFloat(place.lon).toFixed(4)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Logradouro, Número, Complemento */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Logradouro
                  </label>
                  <input
                    type="text"
                    value={addressRoad}
                    onChange={(e) => setAddressRoad(e.target.value)}
                    placeholder="Rua Oscar Freire"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Número
                  </label>
                  <input
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    placeholder="1000"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Complemento <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={addressComplement}
                    onChange={(e) => setAddressComplement(e.target.value)}
                    placeholder="Apto 52, Bloco B"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Bairro, Cidade, Estado, CEP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={addressNeighborhood}
                    onChange={(e) => setAddressNeighborhood(e.target.value)}
                    placeholder="Bela Vista ou Jardins"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    placeholder="São Paulo"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Estado / UF
                  </label>
                  <input
                    type="text"
                    value={addressState}
                    onChange={(e) => setAddressState(e.target.value)}
                    placeholder="SP"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={addressPostalCode}
                    onChange={(e) => setAddressPostalCode(e.target.value)}
                    placeholder="01310-100"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Mapa Interativo */}
              <div className="pt-2">
                <ProjectLocationMap
                  lat={lat}
                  lng={lng}
                  addressTitle={
                    [addressRoad, addressNumber ? `Nº ${addressNumber}` : '', addressNeighborhood]
                      .filter(Boolean)
                      .join(', ') || 'Local da Obra'
                  }
                  onLocationChange={handleLocationChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Descrição ou Observações do Projeto
              </label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Detalhes adicionais sobre o terreno, expectativas de programa ou condicionantes..."
                className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !editTitle.trim() || editClientIds.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
