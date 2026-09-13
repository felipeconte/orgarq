export const DEFAULT_PROJECT_TYPOLOGIES = [
  'Residencial',
  'Comercial',
  'Consultoria',
] as const

export type DefaultProjectTypology = typeof DEFAULT_PROJECT_TYPOLOGIES[number]

export interface ProjectTypologyItem {
  id?: string
  name: string
  is_custom?: boolean
  project_count?: number
}
