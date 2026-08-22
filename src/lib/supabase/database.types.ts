// Generated from the applied Supabase development schema. Do not edit by hand.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          user_id: string
          name: string
          theme: string
          week_starts_on: number
          default_career_target_days: number
          default_weekly_applications: number
          default_weekly_content: number
          timezone: string
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          name?: string
          theme?: string
          week_starts_on?: number
          default_career_target_days?: number
          default_weekly_applications?: number
          default_weekly_content?: number
          timezone?: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          name?: string
          theme?: string
          week_starts_on?: number
          default_career_target_days?: number
          default_weekly_applications?: number
          default_weekly_content?: number
          timezone?: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      content_milestones: {
        Row: {
          id: string
          user_id: string
          category: string
          label: string
          type: string
          target_value: number | null
          achieved_at: string | null
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category?: string
          label: string
          type?: string
          target_value?: number | null
          achieved_at?: string | null
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          label?: string
          type?: string
          target_value?: number | null
          achieved_at?: string | null
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      daily_focus: {
        Row: {
          id: string
          user_id: string
          date: string
          career_mission: string | null
          content_mission: string | null
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          career_mission?: string | null
          content_mission?: string | null
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          career_mission?: string | null
          content_mission?: string | null
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category: string
          start_date: string
          target_date: string | null
          status: string
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          category: string
          start_date: string
          target_date?: string | null
          status?: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          category?: string
          start_date?: string
          target_date?: string | null
          status?: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      quick_thoughts: {
        Row: {
          id: string
          user_id: string
          text: string
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          text: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          text?: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      sprint_weeks: {
        Row: {
          id: string
          user_id: string
          sprint_id: string
          week_number: number
          title: string
          theme: string | null
          outcome: string | null
          start_date: string
          end_date: string
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sprint_id: string
          week_number: number
          title: string
          theme?: string | null
          outcome?: string | null
          start_date: string
          end_date: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sprint_id?: string
          week_number?: number
          title?: string
          theme?: string | null
          outcome?: string | null
          start_date?: string
          end_date?: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_weeks_sprint_fk"
            columns: ["user_id","sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["user_id","id"]
          },
        ]
      }
      sprints: {
        Row: {
          id: string
          user_id: string
          title: string
          start_date: string
          end_date: string
          status: string
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          start_date: string
          end_date: string
          status?: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          start_date?: string
          end_date?: string
          status?: string
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      task_events: {
        Row: {
          id: string
          user_id: string
          task_id: string
          kind: string
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_id: string
          kind: string
          occurred_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string
          kind?: string
          occurred_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_events_task_fk"
            columns: ["user_id","task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["user_id","id"]
          },
        ]
      }
      task_recurrences: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category: string
          priority: string
          estimated_minutes: number | null
          count_per_week: number
          start_week: string
          active: boolean
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          category: string
          priority?: string
          estimated_minutes?: number | null
          count_per_week: number
          start_week: string
          active?: boolean
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          category?: string
          priority?: string
          estimated_minutes?: number | null
          count_per_week?: number
          start_week?: string
          active?: boolean
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category: string
          goal_id: string | null
          sprint_id: string | null
          sprint_week_id: string | null
          date: string
          anytime_week_start: string | null
          recurrence_id: string | null
          recurrence_week_start: string | null
          recurrence_index: number | null
          priority: string
          status: string
          position: number
          estimated_minutes: number | null
          completed_at: string | null
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          category: string
          goal_id?: string | null
          sprint_id?: string | null
          sprint_week_id?: string | null
          date: string
          anytime_week_start?: string | null
          recurrence_id?: string | null
          recurrence_week_start?: string | null
          recurrence_index?: number | null
          priority?: string
          status?: string
          position?: number
          estimated_minutes?: number | null
          completed_at?: string | null
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          category?: string
          goal_id?: string | null
          sprint_id?: string | null
          sprint_week_id?: string | null
          date?: string
          anytime_week_start?: string | null
          recurrence_id?: string | null
          recurrence_week_start?: string | null
          recurrence_index?: number | null
          priority?: string
          status?: string
          position?: number
          estimated_minutes?: number | null
          completed_at?: string | null
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_fk"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_fk"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "task_recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_fk"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_week_fk"
            columns: ["sprint_week_id"]
            isOneToOne: false
            referencedRelation: "sprint_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_targets: {
        Row: {
          id: string
          user_id: string
          sprint_week_id: string
          category: string
          key: string
          label: string
          target_value: number
          revision: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sprint_week_id: string
          category: string
          key: string
          label: string
          target_value: number
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sprint_week_id?: string
          category?: string
          key?: string
          label?: string
          target_value?: number
          revision?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_targets_sprint_week_fk"
            columns: ["user_id","sprint_week_id"]
            isOneToOne: false
            referencedRelation: "sprint_weeks"
            referencedColumns: ["user_id","id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      complete_task: {
        Args: {
          p_task_id: string
          p_expected_revision: number
        }
        Returns: Json
      }
      create_or_update_recurrence: {
        Args: {
          p_input: Json
          p_recurrence_id?: string
          p_expected_revision?: number
          p_client_recurrence_id?: string
        }
        Returns: Json
      }
      create_task: {
        Args: {
          p_input: Json
          p_client_task_id: string
        }
        Returns: Json
      }
      delete_or_deactivate_recurrence: {
        Args: {
          p_recurrence_id: string
          p_expected_revision: number
        }
        Returns: Json
      }
      delete_task: {
        Args: {
          p_task_id: string
          p_expected_revision: number
        }
        Returns: Json
      }
      ensure_recurring_instances: {
        Args: {
          p_week_start: string
        }
        Returns: Json
      }
      move_task_to_tomorrow: {
        Args: {
          p_task_id: string
          p_expected_revision: number
        }
        Returns: Json
      }
      reopen_task: {
        Args: {
          p_task_id: string
          p_expected_revision: number
        }
        Returns: Json
      }
      reorder_task: {
        Args: {
          p_task_id: string
          p_expected_revision: number
          p_direction: string
        }
        Returns: Json
      }
      rls_auto_enable: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      save_daily_focus: {
        Args: {
          p_date: string
          p_career_mission: string
          p_content_mission: string
          p_expected_revision?: number
        }
        Returns: Json
      }
      set_task_workflow: {
        Args: {
          p_task_id: string
          p_expected_revision: number
          p_status: string
        }
        Returns: Json
      }
      update_task: {
        Args: {
          p_task_id: string
          p_expected_revision: number
          p_input: Json
        }
        Returns: Json
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
