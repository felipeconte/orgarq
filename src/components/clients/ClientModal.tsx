'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  User,
  Building,
  Mail,
  Phone,
  FileText,
  MapPin,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import {
  ClientData,
  createClientAction,
  updateClientAction,
} from '@/lib/actions/clients'
import {
  maskCPF,
  maskCNPJ,
  maskPhone,
  maskCEP,
  validateDocument,
  validateEmail,
  validatePhone,
  ESTADOS_BRASIL,
} from '@/lib/formatters-and-validators'
import { lookupCepAction } from '@/lib/actions/cep'
import { useAlert } from '@/components/ui/ConfirmDialog'

export interface ClientModalProps {
  isOpen: boolean
  onClose: () => void
  clientToEdit?: ClientData | null
  organizationId?: string
  onSuccess?: (client: ClientData) => void
}

function parseClientAddress(fullAddress?: string | null) {
  if (!fullAddress) return { street: '', number: '', complement: '', neighborhood: '' }
  const parts = fullAddress.split(' - ')
  const mainPart = parts[0] || ''
  const neighborhood =
    parts.find((p) => p.toLowerCase().startsWith('bairro '))?.replace(/^bairro\s+/i, '') ||
    (parts.length > 2 ? parts[parts.length - 1] : '')
  const complement = parts.length > 1 && !parts[1].toLowerCase().startsWith('bairro ') ? parts[1] : ''

  const mainMatch = mainPart.match(/^(.*?)(?:,\s*(?:Nº\s*|nº\s*|n°\s*)?([0-9A-Za-z\s/]+))?$/)
  if (mainMatch && mainMatch[2]) {
    return {
      street: mainMatch[1].trim(),
      number: mainMatch[2].trim(),
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
    }
  }

  return {
    street: mainPart.trim(),
    number: '',
    complement: complement.trim(),
    neighborhood: neighborhood.trim(),
  }
}

export default function ClientModal({
  isOpen,
  onClose,
  clientToEdit,
  organizationId,
  onSuccess,
}: ClientModalProps) {
  const showAlert = useAlert()
  const numberInputRef = useRef<HTMLInputElement>(null)

  // Form State
  const [personType, setPersonType] = useState<'PF' | 'PJ'>('PF')
  const [name, setName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Address State
  const [zipCode, setZipCode] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  // Other State
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo')

  // Validation and Loading State
  const [isSearchingCep, setIsSearchingCep] = useState(false)
  const [cepSuccessMessage, setCepSuccessMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize or reset when clientToEdit changes
  useEffect(() => {
    if (clientToEdit) {
      setPersonType(clientToEdit.person_type || 'PF')
      setName(clientToEdit.name || '')
      setDocumentNumber(
        clientToEdit.person_type === 'PJ'
          ? maskCNPJ(clientToEdit.document_number || '')
          : maskCPF(clientToEdit.document_number || '')
      )
      setEmail(clientToEdit.email || '')
      setPhone(maskPhone(clientToEdit.phone || ''))
      setZipCode(maskCEP(clientToEdit.zip_code || ''))

      const parsedAddr = parseClientAddress(clientToEdit.address)
      setStreet(parsedAddr.street)
      setNumber(parsedAddr.number)
      setComplement(parsedAddr.complement)
      setNeighborhood(parsedAddr.neighborhood)

      setCity(clientToEdit.city || '')
      setState(clientToEdit.state || '')
      setNotes(clientToEdit.notes || '')
      setStatus(clientToEdit.status || 'ativo')
    } else {
      setPersonType('PF')
      setName('')
      setDocumentNumber('')
      setEmail('')
      setPhone('')
      setZipCode('')
      setStreet('')
      setNumber('')
      setComplement('')
      setNeighborhood('')
      setCity('')
      setState('')
      setNotes('')
      setStatus('ativo')
    }
    setCepSuccessMessage(null)
    setErrors({})
  }, [clientToEdit, isOpen])

  if (!isOpen) return null

  // Change Person Type
  const handlePersonTypeChange = (type: 'PF' | 'PJ') => {
    setPersonType(type)
    setDocumentNumber('')
    setErrors((prev) => {
      const next = { ...prev }
      delete next.documentNumber
      return next
    })
  }

  // Handle Document Input with Mask
  const handleDocumentChange = (val: string) => {
    const masked = personType === 'PJ' ? maskCNPJ(val) : maskCPF(val)
    setDocumentNumber(masked)

    if (masked) {
      const check = validateDocument(masked, personType)
      if (!check.valid) {
        setErrors((prev) => ({ ...prev, documentNumber: check.message || 'Documento inválido.' }))
      } else {
        setErrors((prev) => {
          const next = { ...prev }
          delete next.documentNumber
          return next
        })
      }
    } else {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.documentNumber
        return next
      })
    }
  }

  // Handle Phone with Mask
  const handlePhoneChange = (val: string) => {
    const masked = maskPhone(val)
    setPhone(masked)

    if (masked) {
      if (!validatePhone(masked)) {
        setErrors((prev) => ({ ...prev, phone: 'Telefone inválido (DDD + número).' }))
      } else {
        setErrors((prev) => {
          const next = { ...prev }
          delete next.phone
          return next
        })
      }
    } else {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.phone
        return next
      })
    }
  }

  // Handle Email with Validation
  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (val && !validateEmail(val)) {
      setErrors((prev) => ({ ...prev, email: 'E-mail com formato inválido.' }))
    } else {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.email
        return next
      })
    }
  }

  // Trigger ViaCEP lookup
  const triggerCepLookup = async (cepValue: string) => {
    const rawDigits = cepValue.replace(/\D/g, '')
    if (rawDigits.length !== 8) {
      setErrors((prev) => ({ ...prev, zipCode: 'Digite os 8 dígitos do CEP para buscar.' }))
      return
    }

    setIsSearchingCep(true)
    setCepSuccessMessage(null)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.zipCode
      return next
    })

    const res = await lookupCepAction(rawDigits)
    setIsSearchingCep(false)

    if (res.success && res.data) {
      if (res.data.street) setStreet(res.data.street)
      if (res.data.neighborhood) setNeighborhood(res.data.neighborhood)
      if (res.data.city) setCity(res.data.city)
      if (res.data.state) setState(res.data.state.toUpperCase())

      setCepSuccessMessage('Endereço preenchido com sucesso!')
      setTimeout(() => setCepSuccessMessage(null), 4000)

      // Foca automaticamente no campo de número
      setTimeout(() => {
        numberInputRef.current?.focus()
      }, 100)
    } else {
      setErrors((prev) => ({ ...prev, zipCode: res.error || 'CEP não encontrado.' }))
    }
  }

  // Handle CEP with Mask and Auto ViaCEP Lookup on 8 digits
  const handleCepChange = (val: string) => {
    const masked = maskCEP(val)
    setZipCode(masked)

    const rawDigits = masked.replace(/\D/g, '')
    if (rawDigits.length === 8) {
      triggerCepLookup(rawDigits)
    } else {
      setCepSuccessMessage(null)
      setErrors((prev) => {
        const next = { ...prev }
        delete next.zipCode
        return next
      })
    }
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Nome deve conter pelo menos 2 caracteres.'
    }

    if (documentNumber) {
      const docCheck = validateDocument(documentNumber, personType)
      if (!docCheck.valid) {
        newErrors.documentNumber = docCheck.message || 'Documento inválido.'
      }
    }

    if (email && !validateEmail(email)) {
      newErrors.email = 'E-mail com formato inválido.'
    }

    if (phone && !validatePhone(phone)) {
      newErrors.phone = 'Telefone deve conter DDD válido e 10 a 11 dígitos.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Composição do endereço formatado
    const addressMain = [
      street.trim(),
      number.trim() ? `Nº ${number.trim()}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    const fullAddress = [
      addressMain,
      complement.trim() ? complement.trim() : '',
      neighborhood.trim() ? `Bairro ${neighborhood.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' - ')

    setSaving(true)

    try {
      if (clientToEdit) {
        const res = await updateClientAction(clientToEdit.id, {
          name: name.trim(),
          personType,
          documentNumber: documentNumber || null,
          email: email.trim() || null,
          phone: phone || null,
          zipCode: zipCode || null,
          address: fullAddress || null,
          city: city.trim() || null,
          state: state || null,
          notes: notes.trim() || null,
          status,
        })

        setSaving(false)

        if (res.success && res.client) {
          onSuccess?.(res.client)
          onClose()
        } else {
          await showAlert({
            title: 'Erro ao atualizar cliente',
            message: res.error || 'Não foi possível salvar as alterações do cliente.',
            variant: 'error',
          })
        }
      } else {
        const res = await createClientAction({
          organizationId,
          name: name.trim(),
          personType,
          documentNumber: documentNumber || null,
          email: email.trim() || null,
          phone: phone || null,
          zipCode: zipCode || null,
          address: fullAddress || null,
          city: city.trim() || null,
          state: state || null,
          notes: notes.trim() || null,
          status,
        })

        setSaving(false)

        if (res.success && res.client) {
          onSuccess?.(res.client)
          onClose()
        } else {
          await showAlert({
            title: 'Erro ao cadastrar cliente',
            message: res.error || 'Não foi possível cadastrar o cliente.',
            variant: 'error',
          })
        }
      }
    } catch (err: any) {
      setSaving(false)
      await showAlert({
        title: 'Erro inesperado',
        message: err?.message || 'Ocorreu um erro ao processar a solicitação.',
        variant: 'error',
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 antialiased animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              {personType === 'PJ' ? <Building className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {clientToEdit ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <p className="text-xs text-slate-500">
                {clientToEdit
                  ? 'Atualize os dados e contatos deste cliente.'
                  : 'Cadastre um cliente para vincular a novos e existentes projetos.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Tipo de Pessoa Toggle (PF x PJ) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Tipo de Cliente
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/70 max-w-xs">
              <button
                type="button"
                onClick={() => handlePersonTypeChange('PF')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${personType === 'PF'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <User className="w-3.5 h-3.5" /> Pessoa Física (PF)
              </button>
              <button
                type="button"
                onClick={() => handlePersonTypeChange('PJ')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${personType === 'PJ'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Building className="w-3.5 h-3.5" /> Pessoa Jurídica (PJ)
              </button>
            </div>
          </div>

          {/* Nome / Razão Social */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
              {personType === 'PJ' ? 'Razão Social / Nome da Empresa' : 'Nome Completo'} *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.name
                      return next
                    })
                  }
                }}
                placeholder={personType === 'PJ' ? 'Ex: Studio Arquitetura & Design Ltda.' : 'Ex: Dra. Mariana Vasconcelos'}
                className={`w-full text-xs font-bold border rounded-xl p-3 outline-hidden transition-all bg-slate-50/50 focus:bg-white ${errors.name
                  ? 'border-rose-300 ring-2 ring-rose-500/20 text-rose-900'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900'
                  }`}
                autoFocus
              />
            </div>
            {errors.name && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" /> {errors.name}
              </p>
            )}
          </div>

          {/* Documento (CPF / CNPJ) & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                {personType === 'PJ' ? 'CNPJ' : 'CPF'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  placeholder={personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  className={`w-full text-xs font-mono font-bold border rounded-xl p-3 outline-hidden transition-all bg-slate-50/50 focus:bg-white ${errors.documentNumber
                    ? 'border-rose-300 ring-2 ring-rose-500/20 text-rose-900'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900'
                    }`}
                />
                {documentNumber && !errors.documentNumber && (
                  <Check className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>
              {errors.documentNumber && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {errors.documentNumber}
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Status do Cliente
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ativo' | 'inativo')}
                className="w-full text-xs font-bold border border-slate-200 rounded-xl p-3 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-hidden cursor-pointer"
              >
                <option value="ativo">🟢 Ativo</option>
                <option value="inativo">⚪ Inativo</option>
              </select>
            </div>
          </div>

          {/* Contatos (E-mail e WhatsApp/Telefone) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="cliente@exemplo.com.br"
                className={`w-full text-xs font-semibold border rounded-xl p-3 outline-hidden transition-all bg-slate-50/50 focus:bg-white ${errors.email
                  ? 'border-rose-300 ring-2 ring-rose-500/20 text-rose-900'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900'
                  }`}
              />
              {errors.email && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Telefone / WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(11) 98765-4321"
                className={`w-full text-xs font-mono font-bold border rounded-xl p-3 outline-hidden transition-all bg-slate-50/50 focus:bg-white ${errors.phone
                  ? 'border-rose-300 ring-2 ring-rose-500/20 text-rose-900'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900'
                  }`}
              />
              {errors.phone && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {errors.phone}
                </p>
              )}
            </div>
          </div>

          {/* Endereço & CEP com Busca Automática e Campos Separados */}
          <div className="space-y-3.5 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" /> Localização & Endereço
              </span>
              {isSearchingCep && (
                <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando dados do CEP...
                </span>
              )}
              {cepSuccessMessage && !isSearchingCep && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in duration-200">
                  <Check className="w-3.5 h-3.5" /> {cepSuccessMessage}
                </span>
              )}
            </div>

            {/* Linha 1: CEP e Logradouro */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>CEP</span>
                  <span className="text-[10px] text-blue-600 font-semibold lowercase">busca automática</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={`w-full text-xs font-mono font-bold border rounded-xl p-3 pr-9 outline-hidden transition-all bg-slate-50/50 focus:bg-white ${errors.zipCode
                      ? 'border-rose-300 ring-2 ring-rose-500/20 text-rose-900'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900'
                      }`}
                  />
                  <div className="absolute right-2.5 flex items-center">
                    {isSearchingCep ? (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerCepLookup(zipCode)}
                        title="Buscar endereço por este CEP"
                        className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer transition-colors"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {errors.zipCode && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.zipCode}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Rua / Logradouro / Avenida
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Ex: Av. Paulista, Rua Oscar Freire..."
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-900"
                />
              </div>
            </div>

            {/* Linha 2: Número + Complemento (Opcional) + Bairro */}
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Número
                </label>
                <input
                  ref={numberInputRef}
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="Ex: 1000 ou S/N"
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-900 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Complemento <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Ex: Apto 52, Bloco B"
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Ex: Bela Vista"
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-900"
                />
              </div>
            </div>

            {/* Linha 3: Cidade + Estado (UF) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Belém"
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-900"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Estado (UF)
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={`w-full text-xs font-bold border rounded-xl p-3 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-hidden cursor-pointer transition-all ${!state ? 'text-slate-400 border-slate-200' : 'text-slate-900 border-slate-200'
                    }`}
                >
                  <option value="">
                    Selecione UF
                  </option>
                  {ESTADOS_BRASIL.map((uf) => (
                    <option key={uf.sigla} value={uf.sigla} className="text-slate-900">
                      {uf.sigla} - {uf.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Observações Internas */}
          <div className="pt-2 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Observações e Preferências do Cliente
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Preferência por contato via WhatsApp no período da tarde; casal com 2 filhos..."
              className="w-full text-xs border border-slate-200 rounded-xl p-3 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-800 resize-none"
            />
          </div>

          {/* Actions Bottom Bar */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {clientToEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
