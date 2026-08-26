export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          slug: string
          logo_url: string | null
          cau_caubr: string | null
          cnpj: string | null
          phone: string | null
          email: string | null
          owner_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          slug: string
          logo_url?: string | null
          cau_caubr?: string | null
          cnpj?: string | null
          phone?: string | null
          email?: string | null
          owner_id: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          slug?: string
          logo_url?: string | null
          cau_caubr?: string | null
          cnpj?: string | null
          phone?: string | null
          email?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          user_id: string
          full_name: string | null
          display_name: string | null
          avatar_url: string | null
          phone: string | null
          job_role: string | null
          cau: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          full_name?: string | null
          display_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          job_role?: string | null
          cau?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          full_name?: string | null
          display_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          job_role?: string | null
          cau?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'architect' | 'intern'
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'architect' | 'intern'
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'architect' | 'intern'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      stage_templates: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name?: string
          description?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      stage_template_items: {
        Row: {
          id: string
          stage_template_id: string
          name: string
          description: string | null
          stage_order: number
          default_duration_days: number | null
          is_client_approval_required: boolean
          checklist: any
          created_at: string
        }
        Insert: {
          id?: string
          stage_template_id: string
          name: string
          description?: string | null
          stage_order?: number
          default_duration_days?: number | null
          is_client_approval_required?: boolean
          checklist?: any
          created_at?: string
        }
        Update: {
          id?: string
          stage_template_id?: string
          name?: string
          description?: string | null
          stage_order?: number
          default_duration_days?: number | null
          is_client_approval_required?: boolean
          checklist?: any
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_template_items_stage_template_id_fkey"
            columns: ["stage_template_id"]
            isOneToOne: false
            referencedRelation: "stage_templates"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          code: string
          title: string
          description: string | null
          typology: string | null
          client_name: string
          client_email: string | null
          client_phone: string | null
          status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
          area_sqm: number | null
          estimated_budget: number | null
          address: string | null
          city: string | null
          state: string | null
          start_date: string | null
          deadline: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          code: string
          title: string
          description?: string | null
          typology?: string | null
          client_name: string
          client_email?: string | null
          client_phone?: string | null
          status?: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
          area_sqm?: number | null
          estimated_budget?: number | null
          address?: string | null
          city?: string | null
          state?: string | null
          start_date?: string | null
          deadline?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          code?: string
          title?: string
          description?: string | null
          typology?: string | null
          client_name?: string
          client_email?: string | null
          client_phone?: string | null
          status?: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
          area_sqm?: number | null
          estimated_budget?: number | null
          address?: string | null
          city?: string | null
          state?: string | null
          start_date?: string | null
          deadline?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      project_briefings: {
        Row: {
          id: string
          project_id: string
          needs_program: Json
          style_preferences: string | null
          budget_notes: string | null
          site_conditions: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          needs_program?: Json
          style_preferences?: string | null
          budget_notes?: string | null
          site_conditions?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          needs_program?: Json
          style_preferences?: string | null
          budget_notes?: string | null
          site_conditions?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_briefings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_stages: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          stage_order: number
          status: 'a_iniciar' | 'em_producao' | 'em_aprovacao' | 'concluido'
          progress_percent: number
          assigned_to: string | null
          start_date: string | null
          due_date: string | null
          is_client_approval_required: boolean
          is_locked_for_client: boolean
          checklist: any
          comments: any
          attachments: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string | null
          stage_order?: number
          status?: 'a_iniciar' | 'em_producao' | 'em_aprovacao' | 'concluido'
          progress_percent?: number
          assigned_to?: string | null
          start_date?: string | null
          due_date?: string | null
          is_client_approval_required?: boolean
          is_locked_for_client?: boolean
          checklist?: any
          comments?: any
          attachments?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          stage_order?: number
          status?: 'a_iniciar' | 'em_producao' | 'em_aprovacao' | 'concluido'
          progress_percent?: number
          assigned_to?: string | null
          start_date?: string | null
          due_date?: string | null
          is_client_approval_required?: boolean
          is_locked_for_client?: boolean
          checklist?: any
          comments?: any
          attachments?: any
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          stage_id: string | null
          title: string
          description: string | null
          assigned_to: string | null
          priority: 'low' | 'medium' | 'high' | 'urgent'
          status: 'todo' | 'in_progress' | 'review' | 'done'
          order_index: number
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          stage_id?: string | null
          title: string
          description?: string | null
          assigned_to?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          status?: 'todo' | 'in_progress' | 'review' | 'done'
          order_index?: number
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          stage_id?: string | null
          title?: string
          description?: string | null
          assigned_to?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          status?: 'todo' | 'in_progress' | 'review' | 'done'
          order_index?: number
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      client_access_tokens: {
        Row: {
          id: string
          project_id: string
          token: string
          is_revoked: boolean
          expires_at: string | null
          last_accessed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          token?: string
          is_revoked?: boolean
          expires_at?: string | null
          last_accessed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          token?: string
          is_revoked?: boolean
          expires_at?: string | null
          last_accessed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_access_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      stage_approvals: {
        Row: {
          id: string
          project_id: string
          stage_id: string
          action: 'approved' | 'changes_requested'
          approver_name: string
          approver_email: string | null
          ip_address: string | null
          user_agent: string | null
          feedback_message: string | null
          audit_hash: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          stage_id: string
          action: 'approved' | 'changes_requested'
          approver_name: string
          approver_email?: string | null
          ip_address?: string | null
          user_agent?: string | null
          feedback_message?: string | null
          audit_hash?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          stage_id?: string
          action?: 'approved' | 'changes_requested'
          approver_name?: string
          approver_email?: string | null
          ip_address?: string | null
          user_agent?: string | null
          feedback_message?: string | null
          audit_hash?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_approvals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_portal_project: {
        Args: {
          client_token: string
        }
        Returns: Json
      }
      submit_portal_approval: {
        Args: {
          client_token: string
          target_stage_id: string
          action_type: 'approved' | 'changes_requested'
          approver_name: string
          approver_email?: string
          feedback?: string
          client_ip?: string
          client_ua?: string
        }
        Returns: Json
      }
    }
    Enums: {
      user_role: 'owner' | 'admin' | 'architect' | 'intern'
      project_status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
      stage_status: 'a_iniciar' | 'em_producao' | 'em_aprovacao' | 'concluido'
      task_priority: 'low' | 'medium' | 'high' | 'urgent'
      task_status: 'todo' | 'in_progress' | 'review' | 'done'
      approval_action: 'approved' | 'changes_requested'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
