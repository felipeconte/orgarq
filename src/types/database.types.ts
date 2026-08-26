export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          created_at: string
          name: string
          slug: string
          avatar_url: string | null
          owner_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          slug: string
          avatar_url?: string | null
          owner_id: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          slug?: string
          avatar_url?: string | null
          owner_id?: string
        }
      }
      projects: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          organization_id: string
          title: string
          code: string
          client_name: string
          status: 'briefing' | 'preliminary' | 'executive' | 'construction' | 'completed' | 'on_hold'
          area_sqm: number | null
          budget_estimate: number | null
          deadline: string | null
          address: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          organization_id: string
          title: string
          code: string
          client_name: string
          status?: 'briefing' | 'preliminary' | 'executive' | 'construction' | 'completed' | 'on_hold'
          area_sqm?: number | null
          budget_estimate?: number | null
          deadline?: string | null
          address?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          organization_id?: string
          title?: string
          code?: string
          client_name?: string
          status?: 'briefing' | 'preliminary' | 'executive' | 'construction' | 'completed' | 'on_hold'
          area_sqm?: number | null
          budget_estimate?: number | null
          deadline?: string | null
          address?: string | null
        }
      }
      project_stages: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          stage_order: number
          is_completed: boolean
          due_date: string | null
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string | null
          stage_order: number
          is_completed?: boolean
          due_date?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          stage_order?: number
          is_completed?: boolean
          due_date?: string | null
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          assigned_to: string | null
          priority: 'low' | 'medium' | 'high' | 'urgent'
          status: 'todo' | 'in_progress' | 'review' | 'done'
          due_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          assigned_to?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          status?: 'todo' | 'in_progress' | 'review' | 'done'
          due_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string | null
          assigned_to?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          status?: 'todo' | 'in_progress' | 'review' | 'done'
          due_date?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      project_status: 'briefing' | 'preliminary' | 'executive' | 'construction' | 'completed' | 'on_hold'
      task_priority: 'low' | 'medium' | 'high' | 'urgent'
      task_status: 'todo' | 'in_progress' | 'review' | 'done'
    }
  }
}
