'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Users,
  Search,
  Plus,
  X,
  User,
  Building,
  Mail,
  Phone,
  Check,
  ChevronDown,
} from 'lucide-react'
import { ClientData } from '@/lib/actions/clients'
import ClientModal from '@/components/clients/ClientModal'

export interface ClientMultiSelectProps {
  clients: ClientData[]
  selectedClientIds: string[]
  onChange: (clientIds: string[]) => void
  organizationId?: string
  error?: string | null
  required?: boolean
}

export default function ClientMultiSelect({
  clients,
  selectedClientIds,
  onChange,
  organizationId,
  error,
  required = true,
}: ClientMultiSelectProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Local client list state (allows appending new clients created on the fly)
  const [allClients, setAllClients] = useState<ClientData[]>(clients)

  useEffect(() => {
    setAllClients((prev) => {
      const map = new Map<string, ClientData>()
      clients.forEach((c) => map.set(c.id, c))
      prev.forEach((c) => map.set(c.id, c))
      return Array.from(map.values())
    })
  }, [clients])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Selected client objects
  const selectedClients = useMemo(() => {
    return selectedClientIds
      .map((id) => allClients.find((c) => c.id === id))
      .filter((c): c is ClientData => Boolean(c))
  }, [selectedClientIds, allClients])

  // Filter available clients
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return allClients.filter((c) => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.document_number && c.document_number.includes(q)) ||
        (c.phone && c.phone.includes(q))
      return matchSearch
    })
  }, [allClients, searchQuery])

  // Toggle selection
  const handleToggleClient = (clientId: string) => {
    if (selectedClientIds.includes(clientId)) {
      onChange(selectedClientIds.filter((id) => id !== clientId))
    } else {
      onChange([...selectedClientIds, clientId])
    }
  }

  const handleRemoveClient = (clientId: string) => {
    onChange(selectedClientIds.filter((id) => id !== clientId))
  }

  const handleNewClientCreated = () => {
    // If the modal revalidates or returns, the new client is in the DB
    // We can also trigger a fast fetch or wait for page revalidation
    setIsClientModalOpen(false)
  }

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          Clientes Vinculados ao Projeto {required && <span className="text-rose-500">*</span>}
        </label>

        <button
          type="button"
          onClick={() => setIsClientModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Cadastrar Novo Cliente
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Selecione um ou mais clientes cadastrados. Se houver mais de um cliente, todos deverão aprovar as tarefas marcadas para validação do cliente.
      </p>

      {/* Selected Clients Cards / Chips */}
      {selectedClients.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {selectedClients.map((client) => {
            const isPJ = client.person_type === 'PJ'
            return (
              <div
                key={client.id}
                className="flex items-start justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 transition-all shadow-2xs group relative"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isPJ ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {isPJ ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {client.name}
                      </h4>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                        {isPJ ? 'PJ' : 'PF'}
                      </span>
                    </div>

                    {client.document_number && (
                      <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                        {client.document_number}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                      {client.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          {client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          {client.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveClient(client.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                  title="Remover cliente deste projeto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className={`p-4 rounded-xl border border-dashed text-center ${
            error ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300 bg-slate-50/50'
          }`}
        >
          <Users className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-slate-700">
            Nenhum cliente selecionado
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Busque e selecione abaixo os clientes que fazem parte deste projeto.
          </p>
        </div>
      )}

      {/* Search and Dropdown Trigger */}
      <div className="relative">
        <div
          className={`flex items-center gap-2 px-3.5 py-2.5 bg-slate-50/50 border rounded-xl transition-all cursor-text ${
            isOpen
              ? 'bg-white ring-2 ring-blue-500/20 border-blue-600'
              : error
              ? 'border-rose-300 ring-2 ring-rose-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
          onClick={() => setIsOpen(true)}
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={
              selectedClients.length > 0
                ? 'Buscar mais clientes para vincular (por Nome, CPF/CNPJ, E-mail)...'
                : 'Buscar cliente para vincular ao projeto (por Nome, CPF/CNPJ, E-mail)...'
            }
            className="w-full text-xs text-slate-900 placeholder-slate-400 bg-transparent outline-none"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
            }}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown Options */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-1 space-y-1 animate-in fade-in duration-100">
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => {
                const isSelected = selectedClientIds.includes(client.id)
                const isPJ = client.person_type === 'PJ'

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleToggleClient(client.id)}
                    className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/80 text-blue-950 font-semibold' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          isPJ ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isPJ ? 'PJ' : 'PF'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{client.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {[client.document_number, client.email, client.phone].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Nenhum cliente encontrado para &quot;{searchQuery}&quot;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    setIsClientModalOpen(true)
                  }}
                  className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  + Cadastrar &quot;{searchQuery}&quot; como novo cliente
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-semibold text-rose-600 animate-in fade-in">
          {error}
        </p>
      )}

      {/* Modal para cadastrar novo cliente diretamente */}
      {isClientModalOpen && (
        <ClientModal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          organizationId={organizationId}
          onSuccess={handleNewClientCreated}
        />
      )}
    </div>
  )
}
