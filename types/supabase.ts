// types/supabase.ts
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
        Row: { id: string; name: string; is_club: boolean; owner_id: string; settings: any };
        Insert: { id?: string; name: string; is_club?: boolean; owner_id?: string; settings?: any };
        Update: { id?: string; name?: string; is_club?: boolean; owner_id?: string; settings?: any };
      };
      teams: {
        Row: { id: string; organization_id: string; name: string; owner_id: string; slug: string; logo_url?: string; theme_colors?: string[] };
        Insert: { id?: string; organization_id: string; name: string; owner_id?: string; slug?: string; logo_url?: string; theme_colors?: string[] };
        Update: { id?: string; organization_id?: string; name?: string; owner_id?: string; slug?: string; logo_url?: string; theme_colors?: string[] };
      };
    };
  };
}