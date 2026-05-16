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
      appointment_types: {
        Row: {
          color: string
          company_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number | null
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_type_id: string | null
          color: string | null
          company_id: string
          created_at: string
          created_by: string | null
          dentist_id: string | null
          end_at: string
          id: string
          notes: string | null
          patient_id: string
          price: number | null
          reminder_sent: boolean | null
          start_at: string
          status: Database['public']['Enums']['appointment_status']
          title: string
          updated_at: string
        }
        Insert: {
          appointment_type_id?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          dentist_id?: string | null
          end_at: string
          id?: string
          notes?: string | null
          patient_id: string
          price?: number | null
          reminder_sent?: boolean | null
          start_at: string
          status?: Database['public']['Enums']['appointment_status']
          title: string
          updated_at?: string
        }
        Update: {
          appointment_type_id?: string | null
          color?: string | null
          company_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: Json | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          plan: string
          plan_expires_at: string | null
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          plan?: string
          settings?: Json | null
          slug: string
        }
        Update: {
          name?: string
          slug?: string
          email?: string | null
          phone?: string | null
          document?: string | null
          logo_url?: string | null
          address?: Json | null
          plan?: string
          settings?: Json | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          joined_at: string | null
          role: Database['public']['Enums']['member_role']
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database['public']['Enums']['member_role']
          user_id: string
        }
        Update: {
          role?: Database['public']['Enums']['member_role']
          is_active?: boolean
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: Database['public']['Enums']['conversation_channel']
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          external_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          metadata: Json | null
          patient_id: string | null
          status: Database['public']['Enums']['conversation_status']
          unread_count: number
          updated_at: string
        }
        Insert: {
          channel?: Database['public']['Enums']['conversation_channel']
          company_id: string
          contact_name?: string | null
          contact_phone?: string | null
          id?: string
          patient_id?: string | null
          status?: Database['public']['Enums']['conversation_status']
        }
        Update: {
          assigned_to?: string | null
          status?: Database['public']['Enums']['conversation_status']
          unread_count?: number
          last_message_at?: string | null
          last_message_preview?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          company_id: string
          content: string | null
          conversation_id: string
          created_at: string
          direction: Database['public']['Enums']['message_direction']
          external_id: string | null
          id: string
          media_mime_type: string | null
          media_url: string | null
          metadata: Json | null
          sent_by: string | null
          status: Database['public']['Enums']['message_status']
          type: Database['public']['Enums']['message_type']
        }
        Insert: {
          company_id: string
          content?: string | null
          conversation_id: string
          direction: Database['public']['Enums']['message_direction']
          id?: string
          sent_by?: string | null
          status?: Database['public']['Enums']['message_status']
          type?: Database['public']['Enums']['message_type']
        }
        Update: {
          status?: Database['public']['Enums']['message_status']
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: Json | null
          avatar_url: string | null
          birth_date: string | null
          company_id: string
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          notes: string | null
          phone: string | null
          responsible_user_id: string | null
          source: string | null
          status: Database['public']['Enums']['patient_status']
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          status?: Database['public']['Enums']['patient_status']
          tags?: string[] | null
        }
        Update: {
          email?: string | null
          full_name?: string
          phone?: string | null
          status?: Database['public']['Enums']['patient_status']
          notes?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      pipeline_cards: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          patient_id: string | null
          position: number
          stage_id: string
          tags: string[] | null
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          company_id: string
          created_by?: string | null
          id?: string
          patient_id?: string | null
          position?: number
          stage_id: string
          title: string
          value?: number | null
        }
        Update: {
          description?: string | null
          position?: number
          stage_id?: string
          title?: string
          value?: number | null
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          is_final: boolean
          is_won: boolean
          name: string
          position: number
        }
        Insert: {
          color?: string
          company_id: string
          id?: string
          is_final?: boolean
          is_won?: boolean
          name: string
          position?: number
        }
        Update: {
          color?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_connected_at: string | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          config?: Json
          is_active?: boolean
          last_connected_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          is_read?: boolean
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_default_appointment_types: { Args: { p_company_id: string }; Returns: undefined }
      create_default_pipeline_stages: { Args: { p_company_id: string }; Returns: undefined }
      get_member_role: { Args: { p_company_id: string }; Returns: Database['public']['Enums']['member_role'] }
      get_user_company_id: { Args: Record<string, never>; Returns: string }
      is_member_of: { Args: { p_company_id: string }; Returns: boolean }
    }
    Enums: {
      appointment_status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
      conversation_channel: 'whatsapp' | 'email' | 'sms' | 'webchat' | 'instagram'
      conversation_status: 'open' | 'pending' | 'resolved' | 'archived'
      member_role: 'owner' | 'admin' | 'dentist' | 'receptionist' | 'viewer'
      message_direction: 'inbound' | 'outbound'
      message_status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
      message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template'
      patient_status: 'active' | 'inactive' | 'lead'
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
