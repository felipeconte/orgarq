'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  FolderGit2,
  User,
  Calendar,
  Compass,
  DollarSign,
  Sparkles,
  Lock,
  RefreshCw,
  Copy,
  Check,
  Search,
  MapPin,
  Mail,
  Phone,
  AlertCircle,
  Loader2,
  ListTodo,
  PlusCircle,
  UserCheck,
} from 'lucide-react'
import { createProjectAction } from '@/lib/actions/projects'
import { ClientData } from '@/lib/actions/clients'
import ClientMultiSelect from '@/components/projects/ClientMultiSelect'

// Carregamento dinâmico do mapa para evitar SSR issues com Leaflet
const ProjectLocationMap = dynamic(
  () => import('./ProjectLocationMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-600" /> Carregando mapa...
      </div>
    ),
  }
)

export interface TemplateOption {
  id: string
  name: string
  description: string | null
  is_default: boolean
  count?: number
}

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
    house_name?: string
    suburb?: string
    neighbourhood?: string
    city_district?: string
    quarter?: string
    residential?: string
    city?: string
    town?: string
    municipality?: string
    village?: string
    state?: string
    postcode?: string
    country?: string
  }
}

interface NewProjectFormProps {
  organizationId: string
  userEmail?: string
  templates?: TemplateOption[]
  initialClients?: ClientData[]
  initialClientId?: string
}

function generateRandomCode(): string {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let randomStr = ''
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${today}-${randomStr}`
}

function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11)
  if (numbers.length <= 2) return numbers ? `(${numbers}` : ''
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

function formatCurrencyBRL(value: string | number): { formatted: string; raw: number } {
  const cleanNumber = typeof value === 'number' ? Math.round(value * 100).toString() : value.replace(/\D/g, '')
  if (!cleanNumber) return { formatted: '', raw: 0 }
  const raw = parseFloat(cleanNumber) / 100
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(raw)
  return { formatted, raw }
}

function formatArea(value: string): { formatted: string; raw: number } {
  // Mantém números e no máximo uma vírgula/ponto
  const cleaned = value.replace(/[^0-9.,]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return { formatted: '', raw: 0 }
  return { formatted: `${cleaned} m²`, raw: num }
}

export default function NewProjectForm({
  organizationId,
  templates = [],
  initialClients = [],
  initialClientId = '',
}: NewProjectFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 0. Clientes Cadastrados & Vínculo Multi-Clientes
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(
    initialClientId ? [initialClientId] : []
  )
  const [clientError, setClientError] = useState<string | null>(null)

  // 1. Código do Projeto
  const [projectCode, setProjectCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState(false)

  // 2. Área e Orçamento
  const [areaInput, setAreaInput] = useState<string>('')
  const [areaRaw, setAreaRaw] = useState<number | null>(null)
  const [budgetInput, setBudgetInput] = useState<string>('')
  const [budgetRaw, setBudgetRaw] = useState<number | null>(null)

  // 3. Modelo de Tarefas e Cronograma
  const defaultTpl = templates.find((t) => t.is_default) || templates[0]
  const [templateMode, setTemplateMode] = useState<'template' | 'none'>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTpl?.id || '')

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const def = templates.find((t) => t.is_default) || templates[0]
      if (def) setSelectedTemplateId(def.id)
    }
  }, [templates, selectedTemplateId])

  // 4. Endereço e Localização com campos separados
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimPlace[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [addressRoad, setAddressRoad] = useState<string>('')
  const [addressNumber, setAddressNumber] = useState<string>('')
  const [addressComplement, setAddressComplement] = useState<string>('')
  const [addressNeighborhood, setAddressNeighborhood] = useState<string>('')
  const [addressCity, setAddressCity] = useState<string>('')
  const [addressState, setAddressState] = useState<string>('')
  const [addressPostalCode, setAddressPostalCode] = useState<string>('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  // 5. Estado de Submissão e Erro
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Inicializa o código do projeto automático
  useEffect(() => {
    setProjectCode(generateRandomCode())
  }, [])

  // Fecha dropdown de busca ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Máscara de Orçamento (Moeda)
  const handleBudgetChange = (val: string) => {
    const digits = val.replace(/\D/g, '')
    if (!digits) {
      setBudgetInput('')
      setBudgetRaw(null)
      return
    }
    const { formatted, raw } = formatCurrencyBRL(digits)
    setBudgetInput(formatted)
    setBudgetRaw(raw)
  }

  // Formatação de Área
  const handleAreaChange = (val: string) => {
    // Remove sufixo 'm²' antes de processar
    const rawVal = val.replace(/\s*m²\s*/gi, '').trim()
    if (!rawVal) {
      setAreaInput('')
      setAreaRaw(null)
      return
    }
    const parsed = parseFloat(rawVal.replace(',', '.'))
    if (!isNaN(parsed)) {
      setAreaRaw(parsed)
      setAreaInput(`${rawVal} m²`)
    } else {
      setAreaInput(rawVal)
    }
  }

  // Copiar código
  const handleCopyCode = () => {
    if (!projectCode) return
    navigator.clipboard.writeText(projectCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Gerar novo código
  const handleRegenerateCode = () => {
    setProjectCode(generateRandomCode())
  }

  // Busca de Endereço via Rota de Proxy Segura
  const handleAddressSearchChange = (query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (query.trim().length < 3) {
      setAddressSuggestions([])
      setShowSuggestions(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingAddress(true)
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data: NominatimPlace[] = await response.json()
          setAddressSuggestions(data || [])
          setShowSuggestions((data || []).length > 0)
        }
      } catch (err) {
        console.error('Erro ao buscar endereço:', err)
        setAddressSuggestions([])
      } finally {
        setIsSearchingAddress(false)
      }
    }, 400)
  }

  // Seleção de Endereço sugerido
  const handleSelectSuggestion = (place: NominatimPlace) => {
    setShowSuggestions(false)
    setSearchQuery(place.display_name)

    const addr = place.address || {}
    const road = addr.road || addr.pedestrian || addr.street || ''
    const houseNumber = addr.house_number || addr.house_name || ''
    const neighborhood = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.residential || ''
    const city = addr.city || addr.town || addr.municipality || addr.village || ''
    const state = addr.state || ''
    const postcode = addr.postcode || ''

    setAddressRoad(road || place.display_name.split(',')[0])
    if (houseNumber) {
      setAddressNumber(houseNumber)
    }
    setAddressNeighborhood(neighborhood)
    setAddressCity(city)
    setAddressState(state)
    setAddressPostalCode(postcode)

    const parsedLat = parseFloat(place.lat)
    const parsedLng = parseFloat(place.lon)
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      setLat(parsedLat)
      setLng(parsedLng)
    }
  }

  // Callback quando o usuário move o pin ou clica diretamente no mapa
  const handleLocationChange = async (newLat: number, newLng: number) => {
    setLat(newLat)
    setLng(newLng)

    // Dispara reverse geocoding para preencher automaticamente os campos de endereço
    try {
      const response = await fetch(`/api/geocode?lat=${newLat}&lon=${newLng}`)
      if (response.ok) {
        const place: NominatimPlace = await response.json()
        if (place && place.address) {
          const addr = place.address
          const road = addr.road || addr.pedestrian || addr.street || ''
          const houseNumber = addr.house_number || addr.house_name || ''
          const neighborhood =
            addr.suburb ||
            addr.neighbourhood ||
            addr.city_district ||
            addr.quarter ||
            addr.residential ||
            ''
          const city = addr.city || addr.town || addr.municipality || addr.village || ''
          const state = addr.state || ''
          const postcode = addr.postcode || ''

          if (road) setAddressRoad(road)
          if (houseNumber) setAddressNumber(houseNumber)
          if (neighborhood) setAddressNeighborhood(neighborhood)
          if (city) setAddressCity(city)
          if (state) setAddressState(state)
          if (postcode) setAddressPostalCode(postcode)
        }
      }
    } catch (err) {
      console.error('Erro ao obter endereço a partir das coordenadas:', err)
    }
  }

  // Submissão do Formulário
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    if (selectedClientIds.length === 0) {
      setClientError('Selecione ao menos um cliente cadastrado para vincular ao projeto.')
      setErrorMessage('Por favor, selecione ao menos um cliente para o projeto.')
      return
    }

    setClientError(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    // Injeta os valores processados e normalizados
    formData.set('code', projectCode)
    if (areaRaw !== null) formData.set('areaSqm', areaRaw.toString())
    if (budgetRaw !== null) formData.set('estimatedBudget', budgetRaw.toString())
    if (organizationId) formData.set('organizationId', organizationId)

    // Injeta a lista de IDs de clientes vinculados
    formData.delete('clientIds')
    selectedClientIds.forEach((cid) => formData.append('clientIds', cid))

    // Agrega detalhes completos de endereço e coordenadas
    const addressMain = [
      addressRoad || (formData.get('addressRoad') as string),
      addressNumber ? `Nº ${addressNumber}` : '',
      addressComplement ? addressComplement : '',
    ]
      .filter(Boolean)
      .join(', ')

    const fullAddress = [
      addressMain,
      addressNeighborhood ? `Bairro: ${addressNeighborhood}` : '',
      addressPostalCode ? `CEP: ${addressPostalCode}` : '',
      lat && lng ? `(Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)})` : '',
    ]
      .filter(Boolean)
      .join(' - ')

    if (fullAddress) {
      formData.set('address', fullAddress)
    }
    if (addressCity) {
      formData.set('city', addressCity)
    }
    if (addressState) {
      formData.set('state', addressState)
    }

    // Configuração do Modelo de Tarefas
    if (templateMode === 'none') {
      formData.set('templateOption', 'none')
    } else {
      formData.set('templateOption', selectedTemplateId ? 'custom' : 'default')
      if (selectedTemplateId) {
        formData.set('stageTemplateId', selectedTemplateId)
      }
    }

    startTransition(async () => {
      try {
        const result = await createProjectAction(formData)

        if (result && 'error' in result && result.error) {
          setErrorMessage(result.error)
          return
        }

        if (result && 'projectId' in result && result.projectId) {
          router.push(`/app/projetos/${result.projectId}`)
        } else {
          router.push('/app/projetos')
        }
      } catch (err: unknown) {
        console.error('Erro ao submeter projeto:', err)
        const msg = err instanceof Error ? err.message : 'Falha ao salvar projeto no banco.'
        setErrorMessage(msg)
      }
    })
  }

  return (
    <>
      <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold block">Não foi possível criar o projeto</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <input type="hidden" name="organizationId" value={organizationId} />

          {/* Section 1: Identificação */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <FolderGit2 className="w-4 h-4 text-blue-600" /> Identificação do Projeto
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ponto 1: Código do Projeto Automático e Imutável */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Código do Projeto *
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      title="Gerar outro código aleatório"
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 p-0.5 rounded hover:bg-blue-50"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Regerar
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      title="Copiar código"
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-0.5 p-0.5 rounded hover:bg-slate-100 ml-1"
                    >
                      {copiedCode ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="code"
                    value={projectCode}
                    readOnly
                    required
                    placeholder="Gerando código..."
                    className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono font-bold select-all cursor-not-allowed focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  🔒 Código gerado automaticamente (padrão AAAA-MM-DD-XXXXXX).
                </span>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Título do Projeto *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Residência Alphaville ou Escritório Advocacia"
                  className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tipologia
                </label>
                <select
                  name="typology"
                  defaultValue="Residencial Unifamiliar"
                  className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="Residencial Unifamiliar">Residencial Unifamiliar</option>
                  <option value="Residencial Multifamiliar">Residencial Multifamiliar</option>
                  <option value="Interiores">Interiores / Reforma</option>
                  <option value="Comercial">Comercial / Varejo</option>
                  <option value="Corporativo">Corporativo / Escritórios</option>
                  <option value="Institucional">Institucional</option>
                </select>
              </div>

              {/* Ponto 2: Área do Projeto formatada como medida */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Área do Projeto (m²)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Compass className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    name="areaSqmDisplay"
                    value={areaInput}
                    onChange={(e) => handleAreaChange(e.target.value)}
                    placeholder="Ex: 350 m²"
                    className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Ponto 3: Orçamento Estimado formatado como moeda em tempo real */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Orçamento Estimado (R$)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <DollarSign className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    name="estimatedBudgetDisplay"
                    value={budgetInput}
                    onChange={(e) => handleBudgetChange(e.target.value)}
                    placeholder="R$ 850.000,00"
                    className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Vínculo de Clientes (Multi-Clientes) */}
          <div className="pt-4 border-t border-slate-100">
            <ClientMultiSelect
              clients={initialClients}
              selectedClientIds={selectedClientIds}
              onChange={(ids) => {
                setSelectedClientIds(ids)
                if (ids.length > 0) setClientError(null)
              }}
              organizationId={organizationId}
              error={clientError}
              required
            />
          </div>

          {/* Section 3: Cronograma & Localização */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-blue-600" /> Cronograma & Localização do Projeto
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Data de Início
                </label>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Prazo Final Estimado
                </label>
                <input
                  type="date"
                  name="deadline"
                  className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>

            {/* Ponto 5: Busca Global de Endereço (API Gratuita OpenStreetMap via proxy interno) */}
            <div className="space-y-3">
              <div ref={searchContainerRef} className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Buscar Endereço
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    {isSearchingAddress ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleAddressSearchChange(e.target.value)}
                    onFocus={() => {
                      if (addressSuggestions.length > 0) setShowSuggestions(true)
                    }}
                    placeholder="Digite rua, avenida, condomínio ou cidade no mundo todo para autocompletar..."
                    className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                {/* Dropdown de Sugestões de Endereço */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-30 max-h-60 overflow-y-auto">
                    {addressSuggestions.map((place) => (
                      <button
                        key={place.place_id}
                        type="button"
                        onClick={() => handleSelectSuggestion(place)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-start gap-2.5 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="truncate">
                          <span className="text-xs font-semibold text-slate-800 block truncate">
                            {place.display_name}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Lat: {parseFloat(place.lat).toFixed(4)}, Long: {parseFloat(place.lon).toFixed(4)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Campos de Logradouro, Número e Complemento separados */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Logradouro
                  </label>
                  <input
                    type="text"
                    name="addressRoad"
                    value={addressRoad}
                    onChange={(e) => setAddressRoad(e.target.value)}
                    placeholder="Rua Oscar Freire"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Número
                  </label>
                  <input
                    type="text"
                    name="addressNumber"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    placeholder="1000"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Complemento <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    name="addressComplement"
                    value={addressComplement}
                    onChange={(e) => setAddressComplement(e.target.value)}
                    placeholder="Apto 52, Bloco B"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Campos de Bairro, Cidade, Estado e CEP separados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bairro
                  </label>
                  <input
                    type="text"
                    name="addressNeighborhood"
                    value={addressNeighborhood}
                    onChange={(e) => setAddressNeighborhood(e.target.value)}
                    placeholder="Bela Vista ou Jardins"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Cidade
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    placeholder="São Paulo"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Estado / UF
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={addressState}
                    onChange={(e) => setAddressState(e.target.value)}
                    placeholder="SP"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    CEP
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={addressPostalCode}
                    onChange={(e) => setAddressPostalCode(e.target.value)}
                    placeholder="01310-100"
                    className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Ponto 5: Visualização em Mapa Interativo com Pin */}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Descrição ou Observações do Projeto
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Detalhes adicionais sobre o terreno, expectativas de programa ou condicionantes..."
                className="block w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Section 4: Modelo de Tarefas e Cronograma */}
          <div className="space-y-4 pt-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <ListTodo className="w-4 h-4 text-blue-600" /> Modelo de Tarefas e Cronograma
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Com Template */}
              <div
                onClick={() => setTemplateMode('template')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${templateMode === 'template'
                  ? 'bg-blue-50/40 border-blue-600 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${templateMode === 'template' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                    >
                      <ListTodo className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Usar Modelo Predefinido</h4>
                      <p className="text-[11px] text-slate-500">Inicia com etapas e prazos estruturados</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="templateModeRadio"
                    checked={templateMode === 'template'}
                    onChange={() => setTemplateMode('template')}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                  />
                </div>

                {templateMode === 'template' && (
                  <div className="pt-2 border-t border-blue-100 space-y-2 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                    <label className="block text-[11px] font-bold text-slate-700">Selecione o Modelo:</label>
                    {templates && templates.length > 0 ? (
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-blue-200 rounded-xl p-2.5 text-slate-800 outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                      >
                        {templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name} {tpl.is_default ? '(Padrão do Sistema)' : ''} {tpl.count ? `• ${tpl.count} tarefas` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-white border border-blue-200 text-[11px] text-slate-700 font-medium">
                        📋 Modelo Padrão do Sistema (7 etapas essenciais)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2: Sem Template (Em Branco) */}
              <div
                onClick={() => setTemplateMode('none')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${templateMode === 'none'
                  ? 'bg-blue-50/40 border-blue-600 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${templateMode === 'none' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Projeto em Branco</h4>
                      <p className="text-[11px] text-slate-500">Sem tarefas ou etapas pré-cadastradas</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="templateModeRadio"
                    checked={templateMode === 'none'}
                    onChange={() => setTemplateMode('none')}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                  />
                </div>

                <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  O projeto começará limpo. Você poderá criar tarefas avulsas personalizadas na página do projeto a qualquer momento.
                </p>
              </div>
            </div>
          </div>

          {/* Botoes de Ação */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href="/app/projetos"
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={isPending}
              className="py-2.5 px-6 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition-all flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Criando Projeto...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Criar Projeto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
