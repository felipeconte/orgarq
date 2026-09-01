/**
 * Utilitários para formatação e manipulação de datas no padrão brasileiro (DD/MM/AAAA).
 */

/**
 * Formata uma string de data (YYYY-MM-DD ou ISO) para o padrão brasileiro DD/MM/AAAA.
 * Evita problemas de deslocamento de fuso horário UTC em datas simples sem hora.
 */
export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return ''

  try {
    // Se for string no formato YYYY-MM-DD (comum em inputs type="date" e colunas DATE do SQL)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-')
      return `${day}/${month}/${year}`
    }

    // Se começar com YYYY-MM-DD (ex: 2026-08-28T14:30:00.000Z)
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      return `${day}/${month}/${year}`
    }

    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr

    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateStr || ''
  }
}

/**
 * Formata timestamp ISO para "DD/MM/AAAA às HH:mm"
 */
export function formatDateTimeBR(dateStr?: string | null): string {
  if (!dateStr) return ''

  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr

    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')

    return `${day}/${month}/${year} às ${hours}:${minutes}`
  } catch {
    return dateStr || ''
  }
}

/**
 * Formata um intervalo de datas (start_date e due_date) para exibição amigável.
 * Ex: "28/08/2026 até 15/09/2026", "A partir de 28/08/2026", "Prazo: 15/09/2026", "Datas não definidas"
 */
export function formatDateRangeBR(startDate?: string | null, dueDate?: string | null): string {
  const formattedStart = formatDateBR(startDate)
  const formattedDue = formatDateBR(dueDate)

  if (formattedStart && formattedDue) {
    if (formattedStart === formattedDue) return formattedStart
    return `${formattedStart} até ${formattedDue}`
  }

  if (formattedStart && !formattedDue) {
    return `A partir de ${formattedStart}`
  }

  if (!formattedStart && formattedDue) {
    return `Prazo: ${formattedDue}`
  }

  return 'Datas não definidas'
}

/**
 * Converte com segurança uma string YYYY-MM-DD em um objeto Date local (à meia-noite).
 */
export function parseLocalDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null

  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, y, m, d] = match
      return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0)
    }
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/**
 * Formata dia e mês (DD/MM) para réguas do Gantt.
 */
export function formatDayMonthBR(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

export const SHORT_MONTH_NAMES_BR = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

export const FULL_MONTH_NAMES_BR = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export const SHORT_WEEKDAY_NAMES_BR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function formatMonthYearBR(date: Date): string {
  const month = SHORT_MONTH_NAMES_BR[date.getMonth()]
  const year = date.getFullYear()
  return `${month}/${year}`
}

export function formatMonthFullYearBR(date: Date): string {
  const month = FULL_MONTH_NAMES_BR[date.getMonth()]
  const year = date.getFullYear()
  return `${month} de ${year}`
}

export function formatDayOfWeekShortBR(date: Date): string {
  return SHORT_WEEKDAY_NAMES_BR[date.getDay()]
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function startOfWeekBR(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Dom, 1 = Seg, ...
  const diff = (day === 0 ? -6 : 1) - day // Ajusta para Segunda-feira
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfWeekBR(date: Date): Date {
  const s = startOfWeekBR(date)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  e.setHours(23, 59, 59, 999)
  return e
}

export function startOfMonthBR(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonthBR(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function startOfYearBR(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0)
}

export function endOfYearBR(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)
}

/**
 * Calcula a data de término somando dias corridos à data de início.
 * Ex: start = "2026-09-01", durationDays = 5 -> due = "2026-09-05" (5 dias no total)
 */
export function calculateDueDateFromDuration(
  startDateStr?: string | null,
  durationDays?: number | null
): string {
  if (!startDateStr || !durationDays || durationDays <= 0) return ''
  const start = parseLocalDate(startDateStr)
  if (!start) return ''
  const due = new Date(start)
  due.setDate(due.getDate() + (durationDays - 1))
  const y = due.getFullYear()
  const m = String(due.getMonth() + 1).padStart(2, '0')
  const d = String(due.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Calcula a duração em dias entre start_date e due_date.
 */
export function calculateDurationDays(
  startDateStr?: string | null,
  dueDateStr?: string | null
): number | null {
  if (!startDateStr || !dueDateStr) return null
  const start = parseLocalDate(startDateStr)
  const due = parseLocalDate(dueDateStr)
  if (!start || !due) return null
  const diffTime = due.getTime() - start.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1
  return diffDays > 0 ? diffDays : 1
}

export type TaskTimelineStatusType =
  | 'concluido'
  | 'extrapolou'
  | 'hoje'
  | 'amanha'
  | 'curto'
  | 'longo'
  | 'sem_datas'

export interface TaskTimelineStatusInfo {
  type: TaskTimelineStatusType
  label: string
  shortLabel: string
  daysLeft: number | null
  durationDays: number | null
  badgeColor: string
  badgeBg: string
  badgeBorder: string
  textColor: string
}

/**
 * Avalia o status do prazo/tempo da tarefa em tempo real.
 * Categorias: Concluído, Extrapolou (Atrasada), Vence Hoje, Vence Amanhã, Prazo Curto (<= 3 dias), Prazo Longo (> 3 dias), Sem Datas.
 */
export function getTaskTimelineStatus(
  startDateStr?: string | null,
  dueDateStr?: string | null,
  isCompleted?: boolean
): TaskTimelineStatusInfo {
  const dur = calculateDurationDays(startDateStr, dueDateStr)

  if (isCompleted) {
    return {
      type: 'concluido',
      label: 'Concluído',
      shortLabel: 'Concluído',
      daysLeft: 0,
      durationDays: dur,
      badgeColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-50',
      badgeBorder: 'border-emerald-200',
      textColor: 'text-emerald-700',
    }
  }

  if (!dueDateStr) {
    return {
      type: 'sem_datas',
      label: 'Sem Prazo Definido',
      shortLabel: 'Sem Prazo',
      daysLeft: null,
      durationDays: dur || (startDateStr ? 1 : null),
      badgeColor: 'text-slate-500',
      badgeBg: 'bg-slate-100',
      badgeBorder: 'border-slate-200',
      textColor: 'text-slate-500',
    }
  }

  const due = parseLocalDate(dueDateStr)
  if (!due) {
    return {
      type: 'sem_datas',
      label: 'Data Inválida',
      shortLabel: 'Inválido',
      daysLeft: null,
      durationDays: dur,
      badgeColor: 'text-slate-500',
      badgeBg: 'bg-slate-100',
      badgeBorder: 'border-slate-200',
      textColor: 'text-slate-500',
    }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const diffTime = due.getTime() - today.getTime()
  const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) {
    const daysOverdue = Math.abs(daysLeft)
    return {
      type: 'extrapolou',
      label: `Extrapolou (${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} de atraso)`,
      shortLabel: `Atrasada (${daysOverdue}d)`,
      daysLeft,
      durationDays: dur,
      badgeColor: 'text-rose-700',
      badgeBg: 'bg-rose-50',
      badgeBorder: 'border-rose-200',
      textColor: 'text-rose-700',
    }
  }

  if (daysLeft === 0) {
    return {
      type: 'hoje',
      label: 'Em Cima do Prazo (Vence Hoje)',
      shortLabel: 'Vence Hoje',
      daysLeft: 0,
      durationDays: dur,
      badgeColor: 'text-amber-800',
      badgeBg: 'bg-amber-100/90',
      badgeBorder: 'border-amber-300',
      textColor: 'text-amber-800',
    }
  }

  if (daysLeft === 1) {
    return {
      type: 'amanha',
      label: 'Em Cima do Prazo (Vence Amanhã)',
      shortLabel: 'Vence Amanhã',
      daysLeft: 1,
      durationDays: dur,
      badgeColor: 'text-amber-800',
      badgeBg: 'bg-amber-50',
      badgeBorder: 'border-amber-200',
      textColor: 'text-amber-800',
    }
  }

  if (daysLeft <= 3) {
    return {
      type: 'curto',
      label: `Prazo Curto (Faltam ${daysLeft} dias)`,
      shortLabel: `Prazo Curto (${daysLeft}d)`,
      daysLeft,
      durationDays: dur,
      badgeColor: 'text-amber-700',
      badgeBg: 'bg-amber-50',
      badgeBorder: 'border-amber-200',
      textColor: 'text-amber-700',
    }
  }

  return {
    type: 'longo',
    label: `Prazo Longo (Faltam ${daysLeft} dias)`,
    shortLabel: `No Prazo (${daysLeft}d)`,
    daysLeft,
    durationDays: dur,
    badgeColor: 'text-blue-700',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200',
    textColor: 'text-blue-700',
  }
}

