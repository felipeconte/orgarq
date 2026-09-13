import { lookupCepAction } from '@/lib/actions/cep'

/**
 * Utilitários de Máscaras e Validações Brasileiras para Clientes (CPF, CNPJ, Telefone, CEP, E-mail)
 */

// ==========================================
// 1. MÁSCARAS
// ==========================================

export function cleanDigits(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return isNaN(value) ? 0 : value

  const str = String(value).trim()
  if (!str) return 0

  // Se tem vírgula e ponto (ex: "1.450,50" ou "1,450.50")
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    if (lastComma > lastDot) {
      // Padrão BR: "1.450,50"
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
    } else {
      // Padrão US: "1,450.50"
      return parseFloat(str.replace(/,/g, '')) || 0
    }
  }

  // Se tem apenas vírgula (ex: "1450,50" ou "1450,5")
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
  }

  // Se tem apenas ponto(s) (ex: "1.450.000", "1.450" ou "1450.50")
  const dotCount = (str.match(/\./g) || []).length
  if (dotCount > 1) {
    return parseFloat(str.replace(/\./g, '')) || 0
  }

  if (dotCount === 1) {
    const lastDot = str.lastIndexOf('.')
    const afterDot = str.slice(lastDot + 1)
    // Se tem exatamente 3 dígitos após o ponto (ex: "1.450" ou "25.000"), é separador de milhar brasileiro
    if (afterDot.length === 3) {
      return parseFloat(str.replace(/\./g, '')) || 0
    }
  }

  // Float padrão (ex: "10000" ou "10000.50")
  return parseFloat(str) || 0
}

export function maskCPF(value: string): string {
  const digits = cleanDigits(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

export function maskCNPJ(value: string): string {
  const digits = cleanDigits(value).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

export function maskCPFOrCNPJ(value: string, personType?: 'PF' | 'PJ'): string {
  const digits = cleanDigits(value)
  if (personType === 'PF') return maskCPF(digits)
  if (personType === 'PJ') return maskCNPJ(digits)
  return digits.length > 11 ? maskCNPJ(digits) : maskCPF(digits)
}

export function maskPhone(value: string): string {
  const digits = cleanDigits(value).slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export function maskCEP(value: string): string {
  const digits = cleanDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

// ==========================================
// 2. VALIDAÇÕES DE REGRAS DE NEGÓCIO
// ==========================================

export function validateCPF(cpf: string): boolean {
  const digits = cleanDigits(cpf)
  if (digits.length !== 11) return false

  // Elimina CPFs inválidos conhecidos (todos dígitos iguais)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Validação do 1º dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(digits.charAt(9))) return false

  // Validação do 2º dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(digits.charAt(10))) return false

  return true
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cleanDigits(cnpj)
  if (digits.length !== 14) return false

  // Elimina CNPJs inválidos conhecidos
  if (/^(\d)\1{13}$/.test(digits)) return false

  // Validação do 1º dígito verificador
  let size = digits.length - 2
  let numbers = digits.substring(0, size)
  const digitsCheck = digits.substring(size)
  let sum = 0
  let pos = size - 7

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digitsCheck.charAt(0))) return false

  // Validação do 2º dígito verificador
  size = size + 1
  numbers = digits.substring(0, size)
  sum = 0
  pos = size - 7

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digitsCheck.charAt(1))) return false

  return true
}

export function validateDocument(document: string, personType: 'PF' | 'PJ'): { valid: boolean; message?: string } {
  const digits = cleanDigits(document)
  if (!digits) {
    return { valid: true } // Opcional se vazio
  }

  if (personType === 'PF') {
    if (digits.length !== 11) {
      return { valid: false, message: 'CPF deve conter 11 dígitos.' }
    }
    if (!validateCPF(digits)) {
      return { valid: false, message: 'CPF inválido. Verifique os números.' }
    }
    return { valid: true }
  } else {
    if (digits.length !== 14) {
      return { valid: false, message: 'CNPJ deve conter 14 dígitos.' }
    }
    if (!validateCNPJ(digits)) {
      return { valid: false, message: 'CNPJ inválido. Verifique os números.' }
    }
    return { valid: true }
  }
}

export function validateEmail(email: string): boolean {
  if (!email || !email.trim()) return true // Opcional se vazio
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function validatePhone(phone: string): boolean {
  const digits = cleanDigits(phone)
  if (!digits) return true // Opcional se vazio
  if (digits.length < 10 || digits.length > 11) return false
  const ddd = parseInt(digits.slice(0, 2))
  return ddd >= 11 && ddd <= 99
}

export function validateCEP(cep: string): boolean {
  const digits = cleanDigits(cep)
  if (!digits) return true
  return digits.length === 8
}

// ==========================================
// 3. CONSULTA VIA CEP
// ==========================================

export interface ViaCepResult {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string // Cidade
  uf: string
  erro?: boolean
}

export async function fetchAddressByCEP(cep: string): Promise<{
  success: boolean
  data?: {
    street: string
    neighborhood: string
    city: string
    state: string
  }
  error?: string
}> {
  return lookupCepAction(cep)
}

export const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]

/**
 * Formata a exibição de cliente(s) para cabeçalhos e listagens de projetos.
 * Se houver múltiplos clientes (por IDs vinculados ou se o nome contiver múltiplos separados por '&' ou vírgula),
 * retorna label 'Clientes' e junta os nomes com vírgula (', ').
 * Se for apenas 1 cliente, retorna label 'Cliente'.
 */
export function formatProjectClientDisplay(
  clientName?: string | null,
  clientIds?: string[] | null
): { label: string; names: string; isMultiple: boolean } {
  if (!clientName || !clientName.trim()) {
    return { label: 'Cliente', names: 'Não informado', isMultiple: false }
  }

  // Divide por '&' ou vírgula para identificar clientes individuais
  const rawParts = clientName.split(/\s*&\s*|\s*,\s*/)
  const parts = rawParts.map((p) => p.trim()).filter(Boolean)

  const isMultiple = (clientIds && clientIds.length > 1) || parts.length > 1
  const label = isMultiple ? 'Clientes' : 'Cliente'
  const names = parts.length > 1 ? parts.join(', ') : clientName.trim()

  return { label, names, isMultiple }
}

/**
 * Formata e higieniza a entrada de Área em metros quadrados (m²).
 * Aceita apenas números e separador decimal (, ou .).
 * Ao apagar (Backspace), remove os dígitos corretamente e nunca acumula letras 'm' ou símbolos.
 */
export function parseAreaInput(
  val: string,
  prevInput: string = ''
): { formatted: string; raw: number | null } {
  if (!val || !val.trim()) {
    return { formatted: '', raw: null }
  }

  // Verifica se o usuário pressionou Backspace no final (removendo caracteres do sufixo ' m²')
  const prevHadSuffix = /m²?$/i.test(prevInput.trim())
  const currentSuffixDeleted =
    prevHadSuffix &&
    (val.endsWith(' m') ||
      val.endsWith('m') ||
      val.endsWith(' ') ||
      (prevInput.endsWith(' m²') && val === prevInput.slice(0, -1)) ||
      (prevInput.endsWith(' m²') && val === prevInput.slice(0, -2)) ||
      (prevInput.endsWith(' m²') && val === prevInput.slice(0, -3)))

  let cleanNumberStr = ''
  if (currentSuffixDeleted) {
    const prevDigits = prevInput.replace(/[^\d.,]/g, '').trim()
    cleanNumberStr = prevDigits.slice(0, -1)
  } else {
    // Remove qualquer resquício de 'm', 'M', '²', espaços ou letras
    let stripped = val.replace(/\s*m[\s²2]*$/gi, '').trim()
    stripped = stripped.replace(/[^\d.,]/g, '').trim()
    cleanNumberStr = stripped
  }

  if (!cleanNumberStr) return { formatted: '', raw: null }

  // Se tem vírgula e ponto, mantém apenas o último separador
  const lastComma = cleanNumberStr.lastIndexOf(',')
  const lastDot = cleanNumberStr.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      cleanNumberStr = cleanNumberStr.replace(/\./g, '')
    } else {
      cleanNumberStr = cleanNumberStr.replace(/,/g, '')
    }
  }

  // Evita mais de uma vírgula ou ponto
  const hasComma = cleanNumberStr.includes(',')
  const sep = hasComma ? ',' : '.'
  const parts = cleanNumberStr.split(sep)
  if (parts.length > 2) {
    cleanNumberStr = parts[0] + sep + parts.slice(1).join('')
  }

  const normalizedStr = cleanNumberStr.replace(',', '.')
  const raw = parseFloat(normalizedStr)
  if (isNaN(raw) || raw < 0) return { formatted: '', raw: null }

  const displayNum = cleanNumberStr.replace('.', ',')
  return { formatted: `${displayNum} m²`, raw }
}

/**
 * Formata um número no padrão brasileiro ABNT (XXX.XXX.XXX,XX).
 * Utilizado para exibição de áreas, métricas e valores numéricos em geral.
 */
export function formatNumberBRL(
  val: number | string | null | undefined,
  options?: { minDecimals?: number; maxDecimals?: number; fallback?: string }
): string {
  if (val === null || val === undefined || val === '') {
    return options?.fallback ?? ''
  }

  let num = 0
  if (typeof val === 'number') {
    num = val
  } else {
    const clean = String(val).trim()
    if (!clean) return options?.fallback ?? ''
    const parsed = parseNumber(clean)
    if (isNaN(parsed)) return options?.fallback ?? ''
    num = parsed
  }

  if (isNaN(num)) return options?.fallback ?? ''

  const minDec = options?.minDecimals ?? (num % 1 === 0 ? 0 : 2)
  const maxDec = options?.maxDecimals ?? 2

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec,
  }).format(num)
}

/**
 * Extrai e formata a numeração no padrão brasileiro XXX.XXX.XXX,XX.
 * Regras:
 * 1. O separador decimal é SEMPRE vírgula (,), mesmo se o usuário digitar ponto (.).
 * 2. O separador de milhar é ponto (.) gerado automaticamente.
 * 3. Permite no máximo 2 casas decimais (,XX).
 * 4. Ao apagar (backspace), limpa dígitos suavemente sem travar.
 */
export function formatAreaOnlyNumbers(
  val: string | number | null | undefined,
  prevVal: string = ''
): { display: string; raw: number | null } {
  if (val === null || val === undefined) {
    return { display: '', raw: null }
  }

  const strVal = String(val).trim()
  if (!strVal) return { display: '', raw: null }

  // Permite apenas dígitos, ponto e vírgula
  const clean = strVal.replace(/[^\d.,]/g, '')
  if (!clean) return { display: '', raw: null }

  // Detecta se o usuário acabou de digitar ponto ou vírgula no início (ex: "." ou ",")
  if (clean === '.' || clean === ',') {
    return { display: '0,', raw: 0 }
  }

  // Detecta se o usuário acabou de digitar ponto ou vírgula no final
  const justTypedSep = (strVal.endsWith('.') || strVal.endsWith(',')) && strVal.length > prevVal.length

  // Caso 1: Usuário acabou de digitar ponto ou vírgula no final
  if (justTypedSep) {
    // Se o prevVal já tinha vírgula, ignora nova vírgula
    if (prevVal.includes(',')) {
      return formatAreaOnlyNumbers(prevVal, '')
    }
    const intDigits = clean.slice(0, -1).replace(/\D/g, '')
    if (!intDigits) {
      return { display: '0,', raw: 0 }
    }
    const formattedInt = new Intl.NumberFormat('pt-BR').format(parseInt(intDigits, 10))
    return { display: `${formattedInt},`, raw: parseInt(intDigits, 10) }
  }

  // Caso 2: Processamento com suporte a ambos separadores
  let intPartDigits = ''
  let decPartDigits = ''
  let hasComma = false

  if (clean.includes(',') && clean.includes('.')) {
    hasComma = true
    const lastComma = clean.lastIndexOf(',')
    const lastDot = clean.lastIndexOf('.')
    if (lastComma > lastDot) {
      // Padrão BR: "1.450,50" -> ponto é milhar, vírgula é decimal
      intPartDigits = clean.slice(0, lastComma).replace(/\D/g, '')
      decPartDigits = clean.slice(lastComma + 1).replace(/\D/g, '').slice(0, 2)
    } else {
      // Padrão US colado: "1,450.50" -> vírgula é milhar, ponto é decimal
      intPartDigits = clean.slice(0, lastDot).replace(/\D/g, '')
      decPartDigits = clean.slice(lastDot + 1).replace(/\D/g, '').slice(0, 2)
    }
  } else if (clean.includes(',')) {
    hasComma = true
    const parts = clean.split(',')
    intPartDigits = parts[0].replace(/\D/g, '')
    decPartDigits = parts.slice(1).join('').replace(/\D/g, '').slice(0, 2)
  } else if (clean.includes('.')) {
    // Não tem vírgula, mas tem ponto(s)
    const isDeleting = prevVal && strVal.length < prevVal.length && !prevVal.includes(',')
    if (isDeleting) {
      intPartDigits = clean.replace(/\D/g, '')
      decPartDigits = ''
      hasComma = false
    } else {
      const dotCount = (clean.match(/\./g) || []).length
      const lastDotIndex = clean.lastIndexOf('.')
      const afterDot = clean.slice(lastDotIndex + 1)

      if (dotCount === 1 && afterDot.length > 0 && afterDot.length <= 2) {
        // Ex: "1450.5" ou "1450.50" -> ponto digitado/colado como separador decimal
        intPartDigits = clean.slice(0, lastDotIndex).replace(/\D/g, '')
        decPartDigits = afterDot.replace(/\D/g, '').slice(0, 2)
        hasComma = true
      } else {
        // Ex: "1.450" ou "1.450.000" -> pontos de milhar
        intPartDigits = clean.replace(/\D/g, '')
        decPartDigits = ''
        hasComma = false
      }
    }
  } else {
    // Apenas dígitos normais
    intPartDigits = clean.replace(/\D/g, '')
    decPartDigits = ''
    hasComma = false
  }

  if (!intPartDigits && !decPartDigits) {
    return { display: '', raw: null }
  }

  const intNum = intPartDigits ? parseInt(intPartDigits, 10) : 0
  const formattedInt = intPartDigits ? new Intl.NumberFormat('pt-BR').format(intNum) : '0'

  let display = formattedInt
  if (hasComma) {
    display = `${formattedInt},${decPartDigits}`
  }

  const rawStr = `${intNum}${decPartDigits ? '.' + decPartDigits : ''}`
  const raw = parseFloat(rawStr)

  return { display, raw: isNaN(raw) ? null : raw }
}



