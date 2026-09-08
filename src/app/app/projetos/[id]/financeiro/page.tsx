import { requireProjectAccess } from '@/lib/server/guard'
import { notFound } from 'next/navigation'
import {
  getFinancialTransactionsAction,
  getProjectsProfitabilityAction
} from '@/lib/actions/financial'
import { getCompaniesAction } from '@/lib/actions/companies'
import { getProjectCompaniesAction } from '@/lib/actions/project-companies'
import ProjectFinancialClient from '@/components/projects/ProjectFinancialClient'

export const metadata = {
  title: 'Financeiro do Projeto | Orgarq',
  description: 'Controle individual de faturamento, comissões RT, despesas e lucratividade deste projeto.',
}

export default async function ProjectFinanceiroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { project } = await requireProjectAccess(id)

  if (!project) {
    notFound()
  }

  // 1. Busca transações financeiras, relatórios e fornecedores vinculados
  const [txRes, profRes, compRes, projectCompaniesRes] = await Promise.all([
    getFinancialTransactionsAction({
      organizationId: project.organization_id,
      projectId: id
    }),
    getProjectsProfitabilityAction(project.organization_id),
    getCompaniesAction({
      organizationId: project.organization_id,
      status: 'ativo'
    }),
    getProjectCompaniesAction(id)
  ])

  const initialTransactions = txRes.transactions || []
  const initialProfitability = profRes.projects?.find((p) => p.projectId === id) || null
  const companies = (compRes.companies || []).map((c) => ({
    id: c.id,
    name: c.name,
    trade_name: c.trade_name
  }))

  return (
    <ProjectFinancialClient
      project={{
        id: project.id,
        code: project.code,
        title: project.title,
        client_name: project.client_name,
        organization_id: project.organization_id,
        typology: project.typology,
        area_sqm: project.area_sqm ? Number(project.area_sqm) : null,
        estimated_budget: project.estimated_budget ? Number(project.estimated_budget) : null
      }}
      initialTransactions={initialTransactions}
      initialProfitability={initialProfitability}
      companies={companies}
      projectCompaniesSummary={projectCompaniesRes.summary}
    />
  )
}
