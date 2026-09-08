export interface CompanyContact {
  id: string
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
  is_primary?: boolean
}

export interface CompanyData {
  id: string
  organization_id: string
  name: string
  trade_name: string | null
  document_number: string | null
  person_type: 'PF' | 'PJ'
  categories: string[]
  contacts?: CompanyContact[]
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  website: string | null
  instagram: string | null
  commission_type: 'percent' | 'fixed' | 'none' | 'negotiable'
  commission_rate: number
  commission_payment_method: string | null
  commission_payment_terms: string | null
  notes: string | null
  rating: number
  status: 'ativo' | 'inativo'
  created_at: string
  updated_at: string
  projects_count?: number
  active_projects_count?: number
  total_commission_received?: number
  total_commission_pending?: number
}

export interface CompanyInput {
  organizationId?: string
  name: string
  tradeName?: string | null
  documentNumber?: string | null
  personType?: 'PF' | 'PJ'
  categories?: string[]
  contacts?: CompanyContact[]
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  website?: string | null
  instagram?: string | null
  commissionType?: 'percent' | 'fixed' | 'none' | 'negotiable'
  commissionRate?: number
  commissionPaymentMethod?: string | null
  commissionPaymentTerms?: string | null
  notes?: string | null
  rating?: number
  status?: 'ativo' | 'inativo'
}

export interface CompanyProjectLink {
  id: string
  project_id: string
  project_code: string
  project_title: string
  project_status: string
  client_name: string
  service_description: string | null
  category: string | null
  contract_value: number
  commission_type: 'percent' | 'fixed'
  commission_rate: number
  expected_commission_amount: number
  received_commission_amount: number
  commission_status: 'previsto' | 'pendente' | 'pago_parcial' | 'pago_total' | 'cancelado'
  commission_payment_method: string | null
  commission_payment_terms: string | null
  commission_due_date: string | null
  commission_paid_date: string | null
  service_status: 'cotacao' | 'contratado' | 'em_andamento' | 'concluido' | 'cancelado'
  notes: string | null
  created_at: string
}

export const COMPANY_CATEGORIES = [
  'Marcenaria',
  'Marmoraria & Rochas',
  'Iluminação & Luminotécnica',
  'Vidraçaria & Esquadrias',
  'Pisos & Revestimentos',
  'Tintas & Pintura',
  'Gesso & Drywall',
  'Climatização & Ar-Condicionado',
  'Serralheria & Estruturas Metálicas',
  'Mobiliário & Decoração',
  'Automação Residencial & Áudio',
  'Engenharia & Estrutural',
  'Projetos Complementares (Elétrica/Hidráulica)',
  'Empreiteiro & Obra Civil',
  'Cortinas & Persianas',
  'Paisagismo & Jardinagem',
  'Outros Serviços',
] as const
