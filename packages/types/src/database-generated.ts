export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          ledger_id: string
          month: number | null
          period: Database["public"]["Enums"]["budget_period"] | null
          updated_at: string | null
          year: number
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          ledger_id: string
          month?: number | null
          period?: Database["public"]["Enums"]["budget_period"] | null
          updated_at?: string | null
          year: number
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          ledger_id?: string
          month?: number | null
          period?: Database["public"]["Enums"]["budget_period"] | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          deleted_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          ledger_id: string
          name: string | null
          sort_order: number | null
          template_id: string | null
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          ledger_id: string
          name?: string | null
          sort_order?: number | null
          template_id?: string | null
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          ledger_id?: string
          name?: string | null
          sort_order?: number | null
          template_id?: string | null
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "category_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      category_templates: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      deleted_accounts: {
        Row: {
          auth_deleted_at: string | null
          created_at: string | null
          deleted_at: string
          email_hash: string
          id: string
          original_user_id: string
        }
        Insert: {
          auth_deleted_at?: string | null
          created_at?: string | null
          deleted_at: string
          email_hash: string
          id?: string
          original_user_id: string
        }
        Update: {
          auth_deleted_at?: string | null
          created_at?: string | null
          deleted_at?: string
          email_hash?: string
          id?: string
          original_user_id?: string
        }
        Relationships: []
      }
      deletion_job_logs: {
        Row: {
          profiles_processed: number | null
          created_by: string | null
          deleted_auth_count: number | null
          details: Json | null
          error_count: number | null
          errors: Json | null
          executed_at: string | null
          id: string
        }
        Insert: {
          profiles_processed?: number | null
          created_by?: string | null
          deleted_auth_count?: number | null
          details?: Json | null
          error_count?: number | null
          errors?: Json | null
          executed_at?: string | null
          id?: string
        }
        Update: {
          profiles_processed?: number | null
          created_by?: string | null
          deleted_auth_count?: number | null
          details?: Json | null
          error_count?: number | null
          errors?: Json | null
          executed_at?: string | null
          id?: string
        }
        Relationships: []
      }
      ledger_members: {
        Row: {
          deleted_at: string | null
          id: string
          joined_at: string | null
          ledger_id: string
          role: Database["public"]["Enums"]["member_role"] | null
          user_id: string
        }
        Insert: {
          deleted_at?: string | null
          id?: string
          joined_at?: string | null
          ledger_id: string
          role?: Database["public"]["Enums"]["member_role"] | null
          user_id: string
        }
        Update: {
          deleted_at?: string | null
          id?: string
          joined_at?: string | null
          ledger_id?: string
          role?: Database["public"]["Enums"]["member_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_members_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledgers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string | null
          created_at: string
          id: number
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: number
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: number
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          ledger_id: string
          title: string
          transaction_date: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          ledger_id: string
          title: string
          transaction_date?: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          ledger_id?: string
          title?: string
          transaction_date?: string
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_transactions: {
        Row: {
          amount: number | null
          category_color: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          category_source: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          deleted_at: string | null
          description: string | null
          id: string | null
          ledger_id: string | null
          ledger_name: string | null
          title: string | null
          transaction_date: string | null
          type: Database["public"]["Enums"]["category_type"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_vs_actual: {
        Row: {
          actual_amount: number | null
          budget_amount: number | null
          budget_id: string | null
          category_color: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          ledger_id: string | null
          month: number | null
          period: Database["public"]["Enums"]["budget_period"] | null
          remaining_amount: number | null
          usage_percentage: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      category_details: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          ledger_id: string | null
          name: string | null
          sort_order: number | null
          source_type: string | null
          template_id: string | null
          type: Database["public"]["Enums"]["category_type"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "category_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_monthly_summary: {
        Row: {
          ledger_id: string | null
          month: number | null
          total_amount: number | null
          transaction_count: number | null
          type: Database["public"]["Enums"]["category_type"] | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_default_categories: {
        Args: { target_ledger_id: string }
        Returns: undefined
      }
      add_custom_category: {
        Args: {
          category_color?: string
          category_icon?: string
          category_name: string
          category_sort_order?: number
          category_type: Database["public"]["Enums"]["category_type"]
          target_ledger_id: string
        }
        Returns: string
      }
      cleanup_old_deleted_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_user_profile: {
        Args: {
          p_avatar_url?: string
          p_email: string
          p_full_name?: string
          p_user_id: string
        }
        Returns: boolean
      }
      force_clean_user: {
        Args: { target_user_id: string }
        Returns: Json
      }
      force_delete_auth_user_with_constraints: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_ledger_monthly_stats: {
        Args: {
          target_ledger_id: string
          target_month: number
          target_year: number
        }
        Returns: {
          budget_remaining: number
          budget_total: number
          net_amount: number
          total_expense: number
          total_income: number
          transaction_count: number
        }[]
      }
      get_user_ledgers: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          created_by: string
          currency: string
          description: string
          id: string
          name: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
        }[]
      }
      initialize_category_templates: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      invite_member_to_ledger: {
        Args: {
          member_role?: Database["public"]["Enums"]["member_role"]
          target_ledger_id: string
          target_user_email: string
        }
        Returns: boolean
      }
      process_account_deletions: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      process_account_deletions_v2: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      restore_deleted_account: {
        Args: { target_user_id: string }
        Returns: Json
      }
      set_budget: {
        Args: {
          budget_amount: number
          budget_month?: number
          budget_year: number
          target_category_id: string
          target_ledger_id: string
        }
        Returns: string
      }
      setup_new_user: {
        Args: { user_email: string; user_name: string; user_uuid: string }
        Returns: string
      }
      soft_delete_category: {
        Args: { category_id: string }
        Returns: boolean
      }
      soft_delete_ledger: {
        Args: { ledger_id: string }
        Returns: boolean
      }
      soft_delete_profile: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      soft_delete_transaction: {
        Args: { transaction_id: string }
        Returns: boolean
      }
    }
    Enums: {
      budget_period: "monthly" | "yearly"
      category_type: "income" | "expense"
      member_role: "owner" | "admin" | "member" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      budget_period: ["monthly", "yearly"],
      category_type: ["income", "expense"],
      member_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const