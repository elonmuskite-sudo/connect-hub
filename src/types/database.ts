export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      User: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "admin" | "user" | null;
          avatar_url: string | null;
          created_date: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          role?: "admin" | "user" | null;
          avatar_url?: string | null;
          created_date?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: "admin" | "user" | null;
          avatar_url?: string | null;
          created_date?: string;
        };
      };
      Chat: {
        Row: {
          id: string;
          title: string;
          type: "private" | "group" | "channel";
          avatar_url: string | null;
          participants: string[];
          last_message: string | null;
          last_message_time: string | null;
          last_message_sender_id: string | null;
          unread_count: number;
          pinned: boolean;
          muted: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          type: "private" | "group" | "channel";
          avatar_url?: string | null;
          participants: string[];
          last_message?: string | null;
          last_message_time?: string | null;
          last_message_sender_id?: string | null;
          unread_count?: number;
          pinned?: boolean;
          muted?: boolean;
        };
        Update: {
          id?: string;
          title?: string;
          type?: "private" | "group" | "channel";
          avatar_url?: string | null;
          participants?: string[];
          last_message?: string | null;
          last_message_time?: string | null;
          last_message_sender_id?: string | null;
          unread_count?: number;
          pinned?: boolean;
          muted?: boolean;
        };
      };
      Message: {
        Row: {
          id: string;
          chat_id: string;
          sender_id: string;
          sender_name: string | null;
          content: string;
          type: "text" | "image" | "file" | "voice" | "sticker" | "video" | "system";
          file_url: string | null;
          duration: number | null;
          file_name: string | null;
          reply_to_id: string | null;
          reply_preview: string | null;
          status: "sent" | "delivered" | "read" | null;
          edited: boolean;
          forwarded: boolean;
        };
        Insert: {
          id?: string;
          chat_id: string;
          sender_id: string;
          sender_name?: string | null;
          content: string;
          type: "text" | "image" | "file" | "voice" | "sticker" | "video" | "system";
          file_url?: string | null;
          duration?: number | null;
          file_name?: string | null;
          reply_to_id?: string | null;
          reply_preview?: string | null;
          status?: "sent" | "delivered" | "read" | null;
          edited?: boolean;
          forwarded?: boolean;
        };
        Update: {
          id?: string;
          chat_id?: string;
          sender_id?: string;
          sender_name?: string | null;
          content?: string;
          type?: "text" | "image" | "file" | "voice" | "sticker" | "video" | "system";
          file_url?: string | null;
          duration?: number | null;
          file_name?: string | null;
          reply_to_id?: string | null;
          reply_preview?: string | null;
          status?: "sent" | "delivered" | "read" | null;
          edited?: boolean;
          forwarded?: boolean;
        };
      };
      Contact: {
        Row: {
          id: string;
          user_id: string;
          owner_id: string;
          display_name: string;
          phone: string | null;
          avatar_url: string | null;
          online: boolean;
          last_seen: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          owner_id: string;
          display_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          online?: boolean;
          last_seen?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          owner_id?: string;
          display_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          online?: boolean;
          last_seen?: string | null;
        };
      };
      Story: {
        Row: {
          id: string;
          user_id: string;
          user_name: string | null;
          user_avatar: string | null;
          media_url: string | null;
          media_type: "image" | "video" | "text";
          caption: string | null;
          background_color: string;
          viewers: string[];
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_name?: string | null;
          user_avatar?: string | null;
          media_url?: string | null;
          media_type: "image" | "video" | "text";
          caption?: string | null;
          background_color?: string;
          viewers?: string[];
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_name?: string | null;
          user_avatar?: string | null;
          media_url?: string | null;
          media_type?: "image" | "video" | "text";
          caption?: string | null;
          background_color?: string;
          viewers?: string[];
          expires_at?: string;
        };
      };
    };
  };
}
