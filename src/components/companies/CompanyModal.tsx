'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Percent,
  DollarSign,
  Star,
  Check,
  Globe,
  User,
  Clock,
  CreditCard,
  FileText,
  Search,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Settings2,
  Sparkles
} from 'lucide-react'

function InstagramIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}
import {
  createCompanyAction,
  updateCompanyAction
} from '@/lib/actions/companies'
import {
  getCompanyCategoriesAction,
  createCompanyCategoryAction,
  updateCompanyCategoryAction,
  deleteCompanyCategoryAction,
  CategoryItem
} from '@/lib/actions/company-categories'
import {
  CompanyData,
  CompanyInput,
  CompanyContact,
  COMPANY_CATEGORIES
} from '@/types/companies'
import {
  maskCPFOrCNPJ,
  maskPhone,
  maskCEP,
  fetchAddressByCEP,
  ESTADOS_BRASIL
} from '@/lib/formatters-and-validators'

interface CompanyModalProps {
  isOpen: boolean
  onClose: () => void
  company?: CompanyData | null
  organizationId: string
  onSaved: (company: CompanyData) => void
}

export default function CompanyModal({
  isOpen,
  onClose,
  company,
  organizationId,
  onSaved,
}: CompanyModalProps) {
  const isEditing = Boolean(company?.id)
  const [activeTab, setActiveTab] = useState<'geral' | 'contato' | 'comissao'>('geral')

  // Form State
  const [name, setName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [personType, setPersonType] = useState<'PF' | 'PJ'>('PJ')
  const [documentNumber, setDocumentNumber] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [contacts, setContacts] = useState<CompanyContact[]>([])
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo')
  const [rating, setRating] = useState<number>(5)

  // Categories CRUD State
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>(
    COMPANY_CATEGORIES.map((c) => ({ name: c, is_custom: false }))
  )
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isManageMode, setIsManageMode] = useState(false)
  const [editingCategory, setEditingCategory] = useState<{
    id?: string
    oldName: string
    currentName: string
  } | null>(null)
  const [loadingCategoryAction, setLoadingCategoryAction] = useState(false)
  const newCatInputRef = useRef<HTMLInputElement>(null)
  const editCatInputRef = useRef<HTMLInputElement>(null)

  // Contato & Endereço
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [website, setWebsite] = useState('')
  const [instagram, setInstagram] = useState('')

  // Comissão & Prazos
  const [commissionType, setCommissionType] = useState<'percent' | 'fixed' | 'none' | 'negotiable'>('percent')
  const [commissionRate, setCommissionRate] = useState<string>('10')
  const [commissionPaymentMethod, setCommissionPaymentMethod] = useState('PIX')
  const [commissionPaymentTerms, setCommissionPaymentTerms] = useState('30 dias após emissão da NF')
  const [notes, setNotes] = useState('')

  // UI States
  const [loading, setLoading] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carrega categorias disponíveis da organização ao abrir o modal
  useEffect(() => {
    if (isOpen && organizationId) {
      getCompanyCategoriesAction(organizationId).then((res) => {
        if (res.success && res.categories && res.categories.length > 0) {
          setAvailableCategories(res.categories)
        }
      })
    }
  }, [isOpen, organizationId])

  useEffect(() => {
    if (isOpen) {
      if (company) {
        setName(company.name || '')
        setTradeName(company.trade_name || '')
        setPersonType(company.person_type || 'PJ')
        setDocumentNumber(company.document_number || '')
        setCategories(Array.isArray(company.categories) ? company.categories : [])

        let initialContacts: CompanyContact[] = []
        if (Array.isArray(company.contacts) && company.contacts.length > 0) {
          initialContacts = company.contacts
        } else if (company.contact_name) {
          initialContacts = [
            {
              id: '1',
              name: company.contact_name,
              role: 'Representante Comercial',
              phone: company.phone || '',
              email: company.email || '',
              is_primary: true,
            },
          ]
        }
        setContacts(initialContacts)

        setStatus(company.status || 'ativo')
        setRating(company.rating || 5)
        setEmail(company.email || '')
        setPhone(company.phone || '')
        setZipCode(company.zip_code || '')
        setAddress(company.address || '')
        setCity(company.city || '')
        setState(company.state || '')
        setWebsite(company.website || '')
        setInstagram(company.instagram || '')
        setCommissionType(company.commission_type || 'percent')
        setCommissionRate(String(company.commission_rate ?? 10))
        setCommissionPaymentMethod(company.commission_payment_method || 'PIX')
        setCommissionPaymentTerms(company.commission_payment_terms || '30 dias após emissão da NF')
        setNotes(company.notes || '')
      } else {
        setName('')
        setTradeName('')
        setPersonType('PJ')
        setDocumentNumber('')
        setCategories(['Marcenaria'])
        setContacts([])
        setStatus('ativo')
        setRating(5)
        setEmail('')
        setPhone('')
        setZipCode('')
        setAddress('')
        setCity('')
        setState('')
        setWebsite('')
        setInstagram('')
        setCommissionType('percent')
        setCommissionRate('10')
        setCommissionPaymentMethod('PIX')
        setCommissionPaymentTerms('30 dias após emissão da NF')
        setNotes('')
      }
      setActiveTab('geral')
      setIsAddingCategory(false)
      setNewCategoryName('')
      setEditingCategory(null)
      setIsManageMode(false)
      setError(null)
    }
  }, [isOpen, company])

  useEffect(() => {
    if (isAddingCategory && newCatInputRef.current) {
      newCatInputRef.current.focus()
    }
  }, [isAddingCategory])

  useEffect(() => {
    if (editingCategory && editCatInputRef.current) {
      editCatInputRef.current.focus()
    }
  }, [editingCategory])

  if (!isOpen) return null

  const handleCepBlur = async () => {
    const raw = zipCode.replace(/\D/g, '')
    if (raw.length === 8) {
      setLoadingCep(true)
      const res = await fetchAddressByCEP(raw)
      setLoadingCep(false)
      if (res.success && res.data) {
        if (res.data.street) setAddress(res.data.street)
        if (res.data.city) setCity(res.data.city)
        if (res.data.state) setState(res.data.state)
      }
    }
  }

  const toggleCategory = (catName: string) => {
    setCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    )
  }

  // --- CRUD ESPECIALIDADES / CATEGORIAS ---

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed || trimmed.length < 2) return

    // Se já existir na lista (case insensitive)
    const existing = availableCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    )

    if (existing) {
      if (!categories.includes(existing.name)) {
        setCategories((prev) => [...prev, existing.name])
      }
      setNewCategoryName('')
      setIsAddingCategory(false)
      return
    }

    setLoadingCategoryAction(true)
    const res = await createCompanyCategoryAction(organizationId, trimmed)
    setLoadingCategoryAction(false)

    if (res.success && res.category) {
      const newCat = res.category
      setAvailableCategories((prev) => {
        const copy = [...prev, newCat]
        return copy.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      })
      // Marca automaticamente para a empresa atual
      setCategories((prev) => [...prev, newCat.name])
      setNewCategoryName('')
      setIsAddingCategory(false)
    } else if (res.error) {
      alert(res.error)
    }
  }

  const handleStartEditCategory = (cat: CategoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCategory({
      id: cat.id,
      oldName: cat.name,
      currentName: cat.name,
    })
  }

  const handleSaveEditCategory = async () => {
    if (!editingCategory) return
    const cleanNew = editingCategory.currentName.trim()
    const old = editingCategory.oldName

    if (!cleanNew || cleanNew.length < 2) {
      setEditingCategory(null)
      return
    }

    if (cleanNew.toLowerCase() === old.toLowerCase()) {
      setEditingCategory(null)
      return
    }

    setLoadingCategoryAction(true)
    const res = await updateCompanyCategoryAction(
      organizationId,
      old,
      cleanNew,
      editingCategory.id
    )
    setLoadingCategoryAction(false)

    if (res.success) {
      setAvailableCategories((prev) =>
        prev
          .map((c) => (c.name === old ? { ...c, name: cleanNew } : c))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      )
      // Se estava selecionada nesta empresa, atualiza o nome selecionado
      setCategories((prev) => prev.map((c) => (c === old ? cleanNew : c)))
      setEditingCategory(null)
    } else if (res.error) {
      alert(res.error)
    }
  }

  const handleDeleteCategory = async (cat: CategoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a especialidade "${cat.name}" do catálogo da sua empresa?`
      )
    ) {
      return
    }

    setLoadingCategoryAction(true)
    const res = await deleteCompanyCategoryAction(organizationId, cat.name, cat.id)
    setLoadingCategoryAction(false)

    if (res.success) {
      setAvailableCategories((prev) => prev.filter((c) => c.name !== cat.name))
      setCategories((prev) => prev.filter((c) => c !== cat.name))
      if (editingCategory?.oldName === cat.name) {
        setEditingCategory(null)
      }
    } else if (res.error) {
      alert(res.error)
    }
  }

  // --- CRUD DE VENDEDORES / REPRESENTANTES COMERCIAIS ---

  const handleAddContact = () => {
    const newContact: CompanyContact = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      phone: '',
      email: '',
      is_primary: contacts.length === 0,
    }
    setContacts((prev) => [...prev, newContact])
  }

  const handleUpdateContact = (id: string, field: keyof CompanyContact, value: any) => {
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, [field]: value }
        }
        return c
      })
    )
  }

  const handleRemoveContact = (id: string) => {
    setContacts((prev) => {
      const filtered = prev.filter((c) => c.id !== id)
      if (filtered.length > 0 && !filtered.some((c) => c.is_primary)) {
        filtered[0].is_primary = true
      }
      return filtered
    })
  }

  const handleSetPrimaryContact = (id: string) => {
    setContacts((prev) =>
      prev.map((c) => ({
        ...c,
        is_primary: c.id === id,
      }))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim() || name.trim().length < 2) {
      setError('O nome / razão social é obrigatório e deve ter no mínimo 2 caracteres.')
      setActiveTab('geral')
      return
    }

    setLoading(true)

    // Filtra e prepara contatos válidos
    const validContacts = contacts
      .filter((c) => c.name && c.name.trim().length > 0)
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        role: c.role?.trim() || null,
        phone: c.phone?.trim() || null,
        email: c.email?.trim() || null,
      }))

    const primaryContact = validContacts.find((c) => c.is_primary) || validContacts[0]

    const payload: CompanyInput = {
      organizationId,
      name: name.trim(),
      tradeName: tradeName.trim() || null,
      personType,
      documentNumber: documentNumber.trim() || null,
      categories,
      contacts: validContacts,
      contactName: primaryContact ? primaryContact.name : null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      zipCode: zipCode.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      website: website.trim() || null,
      instagram: instagram.trim() || null,
      commissionType,
      commissionRate: parseFloat(commissionRate.replace(',', '.')) || 0,
      commissionPaymentMethod: commissionPaymentMethod.trim() || null,
      commissionPaymentTerms: commissionPaymentTerms.trim() || null,
      notes: notes.trim() || null,
      rating,
      status,
    }

    try {
      if (isEditing && company) {
        const res = await updateCompanyAction(company.id, payload)
        if (!res.success || !res.company) {
          setError(res.error || 'Erro ao atualizar dados da empresa.')
          setLoading(false)
          return
        }
        onSaved(res.company)
      } else {
        const res = await createCompanyAction(payload)
        if (!res.success || !res.company) {
          setError(res.error || 'Erro ao cadastrar nova empresa.')
          setLoading(false)
          return
        }
        onSaved(res.company)
      }
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {isEditing
                  ? company?.trade_name || company?.name
                    ? `Editar ${company.trade_name || company.name}`
                    : 'Editar Empresa'
                  : 'Nova Empresa ou Prestador de Serviço'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Atualize contatos, escopos e termos de comissionamento'
                  : 'Cadastre fornecedores para vincular a projetos e controlar comissões'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 bg-slate-50/30">
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'geral'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Dados Principais & Categorias
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contato')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'contato'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Phone className="w-3.5 h-3.5" />
            Contatos & Localização
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('comissao')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'comissao'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Percent className="w-3.5 h-3.5" />
            Regras de Comissão & Prazos
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
            {/* TAB 1: GERAL & CATEGORIAS */}
            {activeTab === 'geral' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nome Fantasia / Nome Comercial
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Dicasa"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Razão Social / Nome Oficial <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Dicasa Comercio de Materiais de Construcao LTDA."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Tipo de Pessoa & Documento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tipo de Pessoa
                    </label>
                    <select
                      value={personType}
                      onChange={(e) => {
                        const val = e.target.value as 'PF' | 'PJ'
                        setPersonType(val)
                        setDocumentNumber(maskCPFOrCNPJ(documentNumber, val))
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                      <option value="PF">Pessoa Física (CPF / Profissional Autônomo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {personType === 'PJ' ? 'CNPJ' : 'CPF'}
                    </label>
                    <input
                      type="text"
                      placeholder={personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(maskCPFOrCNPJ(e.target.value, personType))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Avaliação & Pontualidade */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500">
                      <Star className="w-4 h-4 fill-amber-500" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Avaliação de Atendimento & Qualidade
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Classifique a pontualidade e satisfação com este fornecedor
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${star <= rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-200'
                            }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-700 ml-2">
                      {rating}.0 estrelas
                    </span>
                  </div>
                </div>

                {/* Vendedores & Representantes Comerciais (0, 1 ou Múltiplos) */}
                <div className="pt-2 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        Vendedores / Representantes Comerciais
                        <span className="text-[11px] font-semibold text-slate-500 ml-1">
                          ({contacts.length === 0 ? 'Nenhum' : `${contacts.length} ${contacts.length === 1 ? 'cadastrado' : 'cadastrados'}`})
                        </span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Adicione vários ou nenhum vendedor / consultor para esta empresa:
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddContact}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Representante
                    </button>
                  </div>

                  {contacts.length === 0 ? (
                    <div className="p-4 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                        <User className="w-4 h-4" />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Nenhum vendedor ou representante cadastrado no momento.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddContact}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Primeiro Representante
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contacts.map((contact, index) => (
                        <div
                          key={contact.id}
                          className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-3 transition-all relative group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-extrabold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {contact.name.trim() || `Representante ${index + 1}`}
                              </span>
                              {contact.is_primary && (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-md">
                                  ★ Principal
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {!contact.is_primary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryContact(contact.id)}
                                  className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title="Definir como contato principal desta empresa"
                                >
                                  Tornar Principal
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveContact(contact.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Remover este representante"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Nome do Contato <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: Carlos Oliveira"
                                value={contact.name}
                                onChange={(e) => handleUpdateContact(contact.id, 'name', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Cargo / Função
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: Consultor Comercial"
                                value={contact.role || ''}
                                onChange={(e) => handleUpdateContact(contact.id, 'role', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                WhatsApp / Celular
                              </label>
                              <input
                                type="text"
                                placeholder="(00) 00000-0000"
                                value={contact.phone || ''}
                                onChange={(e) => handleUpdateContact(contact.id, 'phone', maskPhone(e.target.value))}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                E-mail
                              </label>
                              <input
                                type="email"
                                placeholder="carlos@empresa.com.br"
                                value={contact.email || ''}
                                onChange={(e) => handleUpdateContact(contact.id, 'email', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Categorias de Atuação com CRUD */}
                <div className="pt-2 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Especialidades & Categorias de Serviços Oferecidos
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Selecione as áreas atendidas por este fornecedor ou adicione/edite novas opções:
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setIsAddingCategory((prev) => !prev)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        Nova Especialidade
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsManageMode((prev) => !prev)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer shadow-2xs ${isManageMode
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                          }`}
                        title="Modo de edição/exclusão de categorias"
                      >
                        <Settings2 className="w-3 h-3" />
                        {isManageMode ? 'Concluir Edição' : 'Gerenciar'}
                      </button>
                    </div>
                  </div>

                  {/* Formulário de Criação Rápida */}
                  {isAddingCategory && (
                    <div className="flex items-center gap-2 p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="relative flex-1">
                        <input
                          ref={newCatInputRef}
                          type="text"
                          placeholder="Nome da especialidade (ex: Paisagismo, Automação, Serralheria Fina)..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddCategory()
                            } else if (e.key === 'Escape') {
                              setIsAddingCategory(false)
                              setNewCategoryName('')
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddCategory}
                        disabled={loadingCategoryAction || !newCategoryName.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        {loadingCategoryAction ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Adicionar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCategory(false)
                          setNewCategoryName('')
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Lista Interativa de Especialidades */}
                  <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                    {availableCategories.map((cat) => {
                      const isSelected = categories.includes(cat.name)
                      const isBeingEdited = editingCategory?.oldName === cat.name

                      if (isBeingEdited) {
                        return (
                          <div
                            key={cat.name}
                            className="inline-flex items-center gap-1.5 p-1 bg-white border-2 border-indigo-500 rounded-xl shadow-xs"
                          >
                            <input
                              ref={editCatInputRef}
                              type="text"
                              value={editingCategory.currentName}
                              onChange={(e) =>
                                setEditingCategory({
                                  ...editingCategory,
                                  currentName: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleSaveEditCategory()
                                } else if (e.key === 'Escape') {
                                  setEditingCategory(null)
                                }
                              }}
                              className="px-2 py-0.5 text-xs font-bold text-slate-800 focus:outline-none w-36 bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={handleSaveEditCategory}
                              disabled={loadingCategoryAction}
                              className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                              title="Salvar alteração"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={cat.name}
                          className={`group relative inline-flex items-center rounded-xl text-xs font-semibold transition-all select-none ${isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCategory(cat.name)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 cursor-pointer"
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            <span>{cat.name}</span>
                          </button>

                          {/* Botões de Ação do CRUD (Editar / Excluir) */}
                          <div
                            className={`flex items-center pr-1.5 transition-opacity ${isManageMode
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100'
                              }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleStartEditCategory(cat, e)}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${isSelected
                                  ? 'text-indigo-200 hover:text-white hover:bg-indigo-700'
                                  : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-200'
                                }`}
                              title={`Renomear "${cat.name}"`}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteCategory(cat, e)}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${isSelected
                                  ? 'text-indigo-200 hover:text-red-300 hover:bg-indigo-700'
                                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                }`}
                              title={`Excluir "${cat.name}"`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CONTATO & LOCALIZAÇÃO */}
            {activeTab === 'contato' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      WhatsApp / Telefone Principal
                    </label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(maskPhone(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      E-mail Comercial / Orçamentos
                    </label>
                    <input
                      type="email"
                      placeholder="orcamentos@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <InstagramIcon className="w-3.5 h-3.5 text-pink-600" />
                      Instagram / Portfolio
                    </label>
                    <input
                      type="text"
                      placeholder="@empresa_arquitetura"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      Website / Catálogo Online
                    </label>
                    <input
                      type="text"
                      placeholder="https://www.empresa.com.br"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        CEP
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="00000-000"
                          value={zipCode}
                          onChange={(e) => setZipCode(maskCEP(e.target.value))}
                          onBlur={handleCepBlur}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                        {loadingCep && (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 absolute right-3 top-3" />
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Endereço Completo (Rua, Número, Bairro)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Av. Brasil, 1500 - Sala 402"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Cidade</label>
                      <input
                        type="text"
                        placeholder="Ex: São Paulo"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Estado (UF)</label>
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Selecione o Estado...</option>
                        {ESTADOS_BRASIL.map((uf) => (
                          <option key={uf.sigla} value={uf.sigla}>
                            {uf.sigla} - {uf.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: REGRAS DE COMISSÃO & PRAZOS */}
            {activeTab === 'comissao' && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100/80">
                  <span className="text-xs font-bold text-indigo-900 block mb-1">
                    Política de Repasse Comercial / Reserva Técnica (RT)
                  </span>
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    Defina como este parceiro calcula e paga comissões ao escritório. Ao vincular a empresa a um projeto, estes valores serão sugeridos automaticamente, podendo ser customizados para cada orçamento.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Modelo de Comissão Padrão
                    </label>
                    <select
                      value={commissionType}
                      onChange={(e) =>
                        setCommissionType(e.target.value as 'percent' | 'fixed' | 'none' | 'negotiable')
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="percent">Porcentagem sobre o Valor Total (%)</option>
                      <option value="fixed">Valor Fixo por Contrato (R$)</option>
                      <option value="negotiable">Negociável a cada Projeto</option>
                      <option value="none">Sem Comissão / Parceria Neutra</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {commissionType === 'percent'
                        ? 'Percentual Padrão (%)'
                        : commissionType === 'fixed'
                          ? 'Valor Fixo Padrão (R$)'
                          : 'Taxa Referência'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={commissionType === 'none'}
                        placeholder={commissionType === 'percent' ? '10' : '1500,00'}
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        className="w-full px-3.5 py-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                      />
                      <div className="absolute left-3 top-2.5 text-slate-400">
                        {commissionType === 'percent' ? (
                          <Percent className="w-4 h-4" />
                        ) : (
                          <DollarSign className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      Forma de Pagamento Praticada
                    </label>
                    <select
                      value={commissionPaymentMethod}
                      onChange={(e) => setCommissionPaymentMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="PIX">PIX Direto</option>
                      <option value="TED">Transferência Bancária (TED/DOC)</option>
                      <option value="Boleto">Boleto / Nota Fiscal de Serviço</option>
                      <option value="Dinheiro">Dinheiro em Espécie</option>
                      <option value="Crédito em Loja / Permuta">Crédito em Loja / Permuta</option>
                      <option value="Outro">Outra Forma Negociada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      Prazo / Gatilho de Pagamento
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 30 dias após emissão da NF"
                      value={commissionPaymentTerms}
                      onChange={(e) => setCommissionPaymentTerms(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Notas Internas, Histórico ou Condições Especiais
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Descreva observações como: prazo de fabricação médio, facilidade de negociação, regras de comissionamento escalonado, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2">
              {activeTab !== 'comissao' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'geral' ? 'contato' : 'comissao')}
                  className="px-4 py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                >
                  Próxima Etapa →
                </button>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-indigo-500/20 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Empresa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
