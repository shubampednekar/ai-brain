export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          timezone: string;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      memories: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string | null;
          organization_id: string | null;
          visibility: 'private' | 'shared';
          original_text: string;
          summary: string | null;
          intent_category_id: string | null;
          intent_slug: string | null;
          intent_confidence: number | null;
          embedding: number[] | null;
          version: number;
          is_active: boolean;
          parent_memory_id: string | null;
          duplicate_classification: 'duplicate' | 'updated_memory' | 'new_memory' | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id?: string | null;
          organization_id?: string | null;
          visibility?: 'private' | 'shared';
          original_text: string;
          summary?: string | null;
          intent_category_id?: string | null;
          intent_slug?: string | null;
          intent_confidence?: number | null;
          embedding?: number[] | null;
          version?: number;
          is_active?: boolean;
          parent_memory_id?: string | null;
          duplicate_classification?: 'duplicate' | 'updated_memory' | 'new_memory' | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memories']['Insert']>;
        Relationships: [];
      };
      memory_versions: {
        Row: {
          id: string;
          memory_id: string;
          version: number;
          original_text: string;
          summary: string | null;
          intent_slug: string | null;
          intent_confidence: number | null;
          metadata: Json;
          changed_by: string | null;
          change_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          memory_id: string;
          version: number;
          original_text: string;
          summary?: string | null;
          intent_slug?: string | null;
          intent_confidence?: number | null;
          metadata?: Json;
          changed_by?: string | null;
          change_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memory_versions']['Insert']>;
        Relationships: [];
      };
      memory_entities: {
        Row: {
          id: string;
          memory_id: string;
          entity_type: string;
          entity_value: string;
          normalized_value: string | null;
          confidence: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          memory_id: string;
          entity_type: string;
          entity_value: string;
          normalized_value?: string | null;
          confidence?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memory_entities']['Insert']>;
        Relationships: [];
      };
      memory_metadata: {
        Row: {
          id: string;
          memory_id: string;
          people: Json;
          organizations: Json;
          projects: Json;
          locations: Json;
          dates: Json;
          topics: Json;
          priority: string | null;
          category: string | null;
          custom_entities: Json;
          extracted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          memory_id: string;
          people?: Json;
          organizations?: Json;
          projects?: Json;
          locations?: Json;
          dates?: Json;
          topics?: Json;
          priority?: string | null;
          category?: string | null;
          custom_entities?: Json;
          extracted_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memory_metadata']['Insert']>;
        Relationships: [];
      };
      memory_relationships: {
        Row: {
          id: string;
          source_memory_id: string;
          target_memory_id: string;
          relationship_type: string;
          confidence: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_memory_id: string;
          target_memory_id: string;
          relationship_type: string;
          confidence?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memory_relationships']['Insert']>;
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          memory_id: string | null;
          title: string;
          description: string | null;
          scheduled_at: string;
          timezone: string;
          priority: 'low' | 'medium' | 'high' | 'urgent';
          recurrence_rule: string | null;
          status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
          context: Json;
          delivery_channels: string[];
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          memory_id?: string | null;
          title: string;
          description?: string | null;
          scheduled_at: string;
          timezone?: string;
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          recurrence_rule?: string | null;
          status?: 'scheduled' | 'sent' | 'cancelled' | 'failed';
          context?: Json;
          delivery_channels?: string[];
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reminders']['Insert']>;
        Relationships: [];
      };
      shopping_lists: {
        Row: {
          id: string;
          user_id: string;
          memory_id: string | null;
          name: string;
          status: 'active' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          memory_id?: string | null;
          name?: string;
          status?: 'active' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shopping_lists']['Insert']>;
        Relationships: [];
      };
      shopping_items: {
        Row: {
          id: string;
          list_id: string;
          memory_id: string | null;
          title: string;
          quantity: string | null;
          store: string | null;
          is_purchased: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          memory_id?: string | null;
          title: string;
          quantity?: string | null;
          store?: string | null;
          is_purchased?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shopping_items']['Insert']>;
        Relationships: [];
      };
      preference_digest_runs: {
        Row: {
          id: string;
          user_id: string;
          run_date: string;
          preferences_snapshot: Json;
          research_results: Json;
          email_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          run_date: string;
          preferences_snapshot?: Json;
          research_results?: Json;
          email_sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['preference_digest_runs']['Insert']>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string | null;
          memory_id: string | null;
          title: string;
          description: string | null;
          assignee_id: string | null;
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          due_at: string | null;
          completed_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id?: string | null;
          memory_id?: string | null;
          title: string;
          description?: string | null;
          assignee_id?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          due_at?: string | null;
          completed_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
        Relationships: [];
      };
      decisions: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string | null;
          memory_id: string | null;
          decision: string;
          reason: string | null;
          decision_maker_id: string | null;
          decided_at: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id?: string | null;
          memory_id?: string | null;
          decision: string;
          reason?: string | null;
          decision_maker_id?: string | null;
          decided_at?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['decisions']['Insert']>;
        Relationships: [];
      };
      approvals: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string | null;
          memory_id: string | null;
          subject: string;
          status: 'approved' | 'rejected' | 'needs_changes' | 'pending';
          approver_id: string | null;
          notes: string | null;
          decided_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id?: string | null;
          memory_id?: string | null;
          subject: string;
          status?: 'approved' | 'rejected' | 'needs_changes' | 'pending';
          approver_id?: string | null;
          notes?: string | null;
          decided_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['approvals']['Insert']>;
        Relationships: [];
      };
      shared_workspaces: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          organization_id: string | null;
          owner_id: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          organization_id?: string | null;
          owner_id: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shared_workspaces']['Insert']>;
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member' | 'viewer';
          invited_by: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: 'owner' | 'admin' | 'member' | 'viewer';
          invited_by?: string | null;
          joined_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workspace_members']['Insert']>;
        Relationships: [];
      };
      workspace_invitations: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          invited_by: string;
          role: 'owner' | 'admin' | 'member' | 'viewer';
          token: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          invited_by: string;
          role?: 'owner' | 'admin' | 'member' | 'viewer';
          token?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workspace_invitations']['Insert']>;
        Relationships: [];
      };
      workspace_question_escalations: {
        Row: {
          id: string;
          workspace_id: string;
          asker_id: string;
          target_id: string;
          question: string;
          ai_answer: string | null;
          confidence: number | null;
          status: 'open' | 'resolved';
          resolved_memory_id: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          asker_id: string;
          target_id: string;
          question: string;
          ai_answer?: string | null;
          confidence?: number | null;
          status?: 'open' | 'resolved';
          resolved_memory_id?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workspace_question_escalations']['Insert']>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          workspace_id: string;
          title: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          workspace_id: string;
          sender_id: string;
          content: string;
          memory_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          workspace_id: string;
          sender_id: string;
          content: string;
          memory_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          summary: string | null;
          timeline: Json;
          ai_summary: string | null;
          last_summarized_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          summary?: string | null;
          timeline?: Json;
          ai_summary?: string | null;
          last_summarized_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
        Relationships: [];
      };
      requirements: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          current_version: number;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          current_version?: number;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['requirements']['Insert']>;
        Relationships: [];
      };
      requirement_versions: {
        Row: {
          id: string;
          requirement_id: string;
          version: number;
          content: string;
          changed_by: string;
          change_reason: string | null;
          memory_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          requirement_id: string;
          version: number;
          content: string;
          changed_by: string;
          change_reason?: string | null;
          memory_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['requirement_versions']['Insert']>;
        Relationships: [];
      };
      intent_categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          icon: string | null;
          color: string | null;
          is_active: boolean;
          sort_order: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          is_active?: boolean;
          sort_order?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['intent_categories']['Insert']>;
        Relationships: [];
      };
      feature_flags: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          is_enabled: boolean;
          rollout_percentage: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          is_enabled?: boolean;
          rollout_percentage?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['feature_flags']['Insert']>;
        Relationships: [];
      };
      domain_events: {
        Row: {
          id: string;
          event_type: string;
          aggregate_type: string;
          aggregate_id: string;
          user_id: string | null;
          payload: Json;
          metadata: Json;
          idempotency_key: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          aggregate_type: string;
          aggregate_id: string;
          user_id?: string | null;
          payload?: Json;
          metadata?: Json;
          idempotency_key?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['domain_events']['Insert']>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          job_type: string;
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
          payload: Json;
          result: Json | null;
          error: string | null;
          attempts: number;
          max_attempts: number;
          idempotency_key: string | null;
          scheduled_at: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_type: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
          payload?: Json;
          result?: Json | null;
          error?: string | null;
          attempts?: number;
          max_attempts?: number;
          idempotency_key?: string | null;
          scheduled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          channel: 'email' | 'push' | 'sms' | 'slack' | 'whatsapp';
          status: 'pending' | 'sent' | 'failed' | 'read';
          title: string;
          body: string;
          metadata: Json;
          sent_at: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel?: 'email' | 'push' | 'sms' | 'slack' | 'whatsapp';
          status?: 'pending' | 'sent' | 'failed' | 'read';
          title: string;
          body: string;
          metadata?: Json;
          sent_at?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          details: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_memories: {
        Args: {
          p_user_id: string;
          p_query: string;
          p_query_embedding?: number[];
          p_workspace_id?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          original_text: string;
          summary: string | null;
          intent_slug: string | null;
          similarity: number;
          text_rank: number;
          combined_score: number;
          created_at: string;
        }[];
      };
      find_similar_memories: {
        Args: {
          p_user_id: string;
          p_embedding: number[];
          p_threshold?: number;
          p_limit?: number;
        };
        Returns: {
          id: string;
          original_text: string;
          similarity: number;
        }[];
      };
      search_workspace_memories: {
        Args: {
          p_workspace_id: string;
          p_query: string;
          p_query_embedding?: number[];
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          user_id: string;
          original_text: string;
          summary: string | null;
          intent_slug: string | null;
          similarity: number;
          text_rank: number;
          combined_score: number;
          created_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
