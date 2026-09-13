import { requireProjectAccess } from '@/lib/server/guard'
import { notFound } from 'next/navigation'
import { getProjectCompaniesAction } from '@/lib/actions/project-companies'
import { getCompaniesAction } from '@/lib/actions/companies'
import ProjectCompaniesClient from '@/components/projects/ProjectCompaniesClient'
import { BreadcrumbSetter } from '@/contexts/BreadcrumbContext'

export const metadata = {
  title: 'Empresas e Serviços do Projeto | Orgarq',
  description: 'Controle de empresas parceiras, escopos de serviços e comissões/RT alocadas neste projeto',
}

export default async function ProjectFornecedoresPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { project } = await requireProjectAccess(id)

  if (!project) {
    notFound()
  }

  // Busca itens vinculados a este projeto
  const { items, summary } = await getProjectCompaniesAction(id)

  // Busca lista de empresas disponíveis na organização
  const { companies } = await getCompaniesAction({
    organizationId: project.organization_id,
    status: 'ativo',
  })

  return (
    <>
      <BreadcrumbSetter
        items={[
          { label: 'Escritório', href: '/app' },
          { label: 'Projetos', href: '/app/projetos' },
          { label: project.title, href: `/app/projetos/${id}` },
          { label: 'Empresas e Serviços' },
        ]}
      />
      <ProjectCompaniesClient
        project={{
          id: project.id,
          code: project.code,
          title: project.title,
          client_name: project.client_name,
          organization_id: project.organization_id,
        }}
        initialItems={items || []}
        availableCompanies={companies || []}
        initialSummary={summary}
      />
    </>
  )
}
