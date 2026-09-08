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
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
          },
          {
            foreignKeyName: "stage_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          id: string
          organization_id: string
          name: string
          person_type: 'PF' | 'PJ'
          document_number: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          notes: string | null
          status: 'ativo' | 'inativo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          person_type?: 'PF' | 'PJ'
          document_number?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          notes?: string | null
          status?: 'ativo' | 'inativo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          person_type?: 'PF' | 'PJ'
          document_number?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          notes?: string | null
          status?: 'ativo' | 'inativo'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      project_clients: {
        Row: {
          id: string
          project_id: string
          client_id: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          client_id: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          client_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_clients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      client_portal_accounts: {
        Row: {
          id: string
          cpf: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          password_hash: string
          created_at: string
          updated_at: string
          last_login_at: string | null
        }
        Insert: {
          id?: string
          cpf: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          password_hash: string
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
        }
        Update: {
          id?: string
          cpf?: string
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          password_hash?: string
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
        }
        Relationships: []
      }
      client_update_requests: {
        Row: {
          id: string
          organization_id: string
          client_id: string | null
          portal_account_id: string | null
          cpf: string
          requested_data: Json
          current_data: Json | null
          status: 'pending' | 'approved' | 'rejected'
          reviewed_by: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          client_id?: string | null
          portal_account_id?: string | null
          cpf: string
          requested_data: Json
          current_data?: Json | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string | null
          portal_account_id?: string | null
          cpf?: string
          requested_data?: Json
          current_data?: Json | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_update_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_update_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      companies: {
        Row: {
          id: string
          organization_id: string
          name: string
          trade_name: string | null
          document_number: string | null
          person_type: 'PF' | 'PJ'
          categories: string[]
          contacts: Json | null
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
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          trade_name?: string | null
          document_number?: string | null
          person_type?: 'PF' | 'PJ'
          categories?: string[]
          contacts?: Json | null
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          website?: string | null
          instagram?: string | null
          commission_type?: 'percent' | 'fixed' | 'none' | 'negotiable'
          commission_rate?: number
          commission_payment_method?: string | null
          commission_payment_terms?: string | null
          notes?: string | null
          rating?: number
          status?: 'ativo' | 'inativo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          trade_name?: string | null
          document_number?: string | null
          person_type?: 'PF' | 'PJ'
          categories?: string[]
          contacts?: Json | null
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          website?: string | null
          instagram?: string | null
          commission_type?: 'percent' | 'fixed' | 'none' | 'negotiable'
          commission_rate?: number
          commission_payment_method?: string | null
          commission_payment_terms?: string | null
          notes?: string | null
          rating?: number
          status?: 'ativo' | 'inativo'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      project_companies: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          company_id: string
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
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          company_id: string
          service_description?: string | null
          category?: string | null
          contract_value?: number
          commission_type?: 'percent' | 'fixed'
          commission_rate?: number
          expected_commission_amount?: number
          received_commission_amount?: number
          commission_status?: 'previsto' | 'pendente' | 'pago_parcial' | 'pago_total' | 'cancelado'
          commission_payment_method?: string | null
          commission_payment_terms?: string | null
          commission_due_date?: string | null
          commission_paid_date?: string | null
          service_status?: 'cotacao' | 'contratado' | 'em_andamento' | 'concluido' | 'cancelado'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          company_id?: string
          service_description?: string | null
          category?: string | null
          contract_value?: number
          commission_type?: 'percent' | 'fixed'
          commission_rate?: number
          expected_commission_amount?: number
          received_commission_amount?: number
          commission_status?: 'previsto' | 'pendente' | 'pago_parcial' | 'pago_total' | 'cancelado'
          commission_payment_method?: string | null
          commission_payment_terms?: string | null
          commission_due_date?: string | null
          commission_paid_date?: string | null
          service_status?: 'cotacao' | 'contratado' | 'em_andamento' | 'concluido' | 'cancelado'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_companies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      company_categories: {
        Row: {
          id: string
          organization_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      recurring_expenses: {
        Row: {
          id: string
          organization_id: string
          project_id: string | null
          client_id: string | null
          company_id: string | null
          type: string
          title: string
          category: string
          amount: number
          frequency: string
          due_day: number
          start_date: string
          end_date: string | null
          payment_method: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id?: string | null
          client_id?: string | null
          company_id?: string | null
          type?: string
          title: string
          category: string
          amount: number
          frequency?: string
          due_day?: number
          start_date?: string
          end_date?: string | null
          payment_method?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string | null
          client_id?: string | null
          company_id?: string | null
          type?: string
          title?: string
          category?: string
          amount?: number
          frequency?: string
          due_day?: number
          start_date?: string
          end_date?: string | null
          payment_method?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      financial_transactions: {
        Row: {
          id: string
          organization_id: string
          project_id: string | null
          company_id: string | null
          client_id: string | null
          recurring_expense_id: string | null
          project_company_id: string | null
          type: string
          category: string
          title: string
          description: string | null
          amount: number
          due_date: string
          payment_date: string | null
          status: string
          payment_method: string | null
          receipt_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id?: string | null
          company_id?: string | null
          client_id?: string | null
          recurring_expense_id?: string | null
          project_company_id?: string | null
          type: string
          category: string
          title: string
          description?: string | null
          amount: number
          due_date: string
          payment_date?: string | null
          status?: string
          payment_method?: string | null
          receipt_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string | null
          company_id?: string | null
          client_id?: string | null
          recurring_expense_id?: string | null
          project_company_id?: string | null
          type?: string
          category?: string
          title?: string
          description?: string | null
          amount?: number
          due_date?: string
          payment_date?: string | null
          status?: string
          payment_method?: string | null
          receipt_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_project_company_id_fkey"
            columns: ["project_company_id"]
            isOneToOne: false
            referencedRelation: "project_companies"
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
