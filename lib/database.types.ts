// Generated from the Supabase schema. Regenerate after every migration; do not edit by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_spend: {
        Row: {
          cost_usd: number
          created_at: string
          id: number
          job_id: string | null
          label: string | null
          model: string
          provider: string
        }
        Insert: {
          cost_usd: number
          created_at?: string
          id?: never
          job_id?: string | null
          label?: string | null
          model: string
          provider: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: never
          job_id?: string | null
          label?: string | null
          model?: string
          provider?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: number
          item_id: string | null
          page_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: never
          item_id?: string | null
          page_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: never
          item_id?: string | null
          page_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          description: string | null
          display_order: number | null
          hidden: boolean
          real_size_m: number | null
          styled_image_path: string | null
          box: Json | null
          brand: string | null
          category: string | null
          confidence: number | null
          created_at: string
          crop_path: string | null
          currency: string | null
          fal_request_id: string | null
          fallback: boolean
          glb_path: string | null
          id: string
          idx: number
          job_id: string
          link: string | null
          mask_path: string | null
          model: string | null
          name: string
          phrase: string | null
          price: number | null
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
          user_edited: boolean
        }
        Insert: {
          description?: string | null
          display_order?: number | null
          hidden?: boolean
          real_size_m?: number | null
          styled_image_path?: string | null
          box?: Json | null
          brand?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          crop_path?: string | null
          currency?: string | null
          fal_request_id?: string | null
          fallback?: boolean
          glb_path?: string | null
          id?: string
          idx: number
          job_id: string
          link?: string | null
          mask_path?: string | null
          model?: string | null
          name: string
          phrase?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          user_edited?: boolean
        }
        Update: {
          description?: string | null
          display_order?: number | null
          hidden?: boolean
          real_size_m?: number | null
          styled_image_path?: string | null
          box?: Json | null
          brand?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          crop_path?: string | null
          currency?: string | null
          fal_request_id?: string | null
          fallback?: boolean
          glb_path?: string | null
          id?: string
          idx?: number
          job_id?: string
          link?: string | null
          mask_path?: string | null
          model?: string | null
          name?: string
          phrase?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          user_edited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_requests: {
        Row: {
          created_at: string
          id: number
          ip_hash: string
          job_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          ip_hash: string
          job_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          ip_hash?: string
          job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          cost: Json
          created_at: string
          error: string | null
          id: string
          photo_hash: string | null
          photo_path: string | null
          status: Database["public"]["Enums"]["job_status"]
          template: string | null
          timings: Json
          updated_at: string
          user_message: string | null
        }
        Insert: {
          cost?: Json
          created_at?: string
          error?: string | null
          id?: string
          photo_hash?: string | null
          photo_path?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          template?: string | null
          timings?: Json
          updated_at?: string
          user_message?: string | null
        }
        Update: {
          cost?: Json
          created_at?: string
          error?: string | null
          id?: string
          photo_hash?: string | null
          photo_path?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          template?: string | null
          timings?: Json
          updated_at?: string
          user_message?: string | null
        }
        Relationships: []
      }
      model_cache: {
        Row: {
          created_at: string
          key: string
          model: string
          provider: string
          response: Json
        }
        Insert: {
          created_at?: string
          key: string
          model: string
          provider: string
          response: Json
        }
        Update: {
          created_at?: string
          key?: string
          model?: string
          provider?: string
          response?: Json
        }
        Relationships: []
      }
      page_secrets: {
        Row: {
          edit_token_hash: string
          page_id: string
        }
        Insert: {
          edit_token_hash: string
          page_id: string
        }
        Update: {
          edit_token_hash?: string
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_secrets_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          affiliate_tag: string | null
          avatar_path: string | null
          created_at: string
          handle: string | null
          id: string
          job_id: string
          mode: string
          og_image_path: string | null
          published: boolean
          slug: string
          theme: string
          title: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          affiliate_tag?: string | null
          avatar_path?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          job_id: string
          mode?: string
          og_image_path?: string | null
          published?: boolean
          slug: string
          theme?: string
          title: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          affiliate_tag?: string | null
          avatar_path?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          job_id?: string
          mode?: string
          og_image_path?: string | null
          published?: boolean
          slug?: string
          theme?: string
          title?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          cover_path: string | null
          created_at: string
          id: string
          job_id: string
          mp4_path: string | null
          preset: string | null
          settings: Json
          share_slug: string | null
          title: string | null
          world_path: string | null
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          id?: string
          job_id: string
          mp4_path?: string | null
          preset?: string | null
          settings?: Json
          share_slug?: string | null
          title?: string | null
          world_path?: string | null
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          id?: string
          job_id?: string
          mp4_path?: string | null
          preset?: string | null
          settings?: Json
          share_slug?: string | null
          title?: string | null
          world_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reels_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      spend_by_provider: {
        Args: never
        Returns: {
          cost_usd: number
          provider: string
        }[]
      }
    }
    Enums: {
      item_status:
        | "pending"
        | "segmented"
        | "reconstructing"
        | "ready"
        | "fallback"
        | "failed"
      job_status:
        | "uploaded"
        | "listing"
        | "segmenting"
        | "awaiting_confirm"
        | "reconstructing"
        | "ready"
        | "failed"
        | "budget_exceeded"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      item_status: [
        "pending",
        "segmented",
        "reconstructing",
        "ready",
        "fallback",
        "failed",
      ],
      job_status: [
        "uploaded",
        "listing",
        "segmenting",
        "awaiting_confirm",
        "reconstructing",
        "ready",
        "failed",
        "budget_exceeded",
      ],
    },
  },
} as const
