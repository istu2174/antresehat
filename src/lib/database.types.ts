// Tipe database Supabase. Ditulis manual mengikuti format `supabase gen types`;
// setelah project tersambung, jalankan `npm run db:types` untuk menimpanya dengan hasil generate.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type UserRole = "pasien" | "resepsionis" | "dokter" | "admin";
type JenisKelamin = "L" | "P";
type SumberAntrean = "booking" | "walkin";
type StatusAntrean =
  | "menunggu" | "check_in" | "dipanggil" | "diperiksa" | "selesai" | "dilewati" | "batal" | "tidak_datang";

type AntreanRow = {
  id: string;
  kode_tiket: string;
  tanggal: string;
  poli_id: string;
  dokter_id: string;
  jadwal_id: string;
  pasien_id: string;
  nomor: number;
  nomor_label: string;
  sumber: SumberAntrean;
  status: StatusAntrean;
  urutan: number;
  jumlah_dilewati: number;
  estimasi_jam: string | null;
  waktu_booking: string;
  waktu_checkin: string | null;
  waktu_dipanggil: string | null;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          nama: string;
          no_hp: string | null;
          tgl_lahir: string | null;
          jenis_kelamin: JenisKelamin | null;
          nik_terenkripsi: string | null;
          created_at: string;
        };
        Insert: never; // dibuat trigger handle_new_user
        // role hanya bisa diubah lewat service role (grant kolom di migration RLS memblokir klien).
        Update: { nama?: string; no_hp?: string | null; tgl_lahir?: string | null; jenis_kelamin?: JenisKelamin | null; role?: UserRole };
        Relationships: [];
      };
      polis: {
        Row: { id: string; nama: string; kode_prefix: string; warna: string; aktif: boolean };
        Insert: { id?: string; nama: string; kode_prefix: string; warna?: string; aktif?: boolean };
        Update: { id?: string; nama?: string; kode_prefix?: string; warna?: string; aktif?: boolean };
        Relationships: [];
      };
      dokters: {
        Row: {
          id: string; profile_id: string | null; poli_id: string; nama: string;
          spesialis: string; foto_url: string | null; aktif: boolean;
        };
        Insert: {
          id?: string; profile_id?: string | null; poli_id: string; nama: string;
          spesialis: string; foto_url?: string | null; aktif?: boolean;
        };
        Update: {
          id?: string; profile_id?: string | null; poli_id?: string; nama?: string;
          spesialis?: string; foto_url?: string | null; aktif?: boolean;
        };
        Relationships: [
          { foreignKeyName: "dokters_poli_id_fkey"; columns: ["poli_id"]; isOneToOne: false; referencedRelation: "polis"; referencedColumns: ["id"] },
          { foreignKeyName: "dokters_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      jadwal_praktik: {
        Row: {
          id: string; dokter_id: string; hari: number; jam_mulai: string; jam_selesai: string;
          kuota: number; menit_per_pasien: number; aktif: boolean;
        };
        Insert: {
          id?: string; dokter_id: string; hari: number; jam_mulai: string; jam_selesai: string;
          kuota: number; menit_per_pasien: number; aktif?: boolean;
        };
        Update: {
          id?: string; dokter_id?: string; hari?: number; jam_mulai?: string; jam_selesai?: string;
          kuota?: number; menit_per_pasien?: number; aktif?: boolean;
        };
        Relationships: [
          { foreignKeyName: "jadwal_praktik_dokter_id_fkey"; columns: ["dokter_id"]; isOneToOne: false; referencedRelation: "dokters"; referencedColumns: ["id"] },
        ];
      };
      libur: {
        Row: { id: string; tanggal: string; dokter_id: string | null; keterangan: string };
        Insert: { id?: string; tanggal: string; dokter_id?: string | null; keterangan?: string };
        Update: { id?: string; tanggal?: string; dokter_id?: string | null; keterangan?: string };
        Relationships: [
          { foreignKeyName: "libur_dokter_id_fkey"; columns: ["dokter_id"]; isOneToOne: false; referencedRelation: "dokters"; referencedColumns: ["id"] },
        ];
      };
      antrean: {
        Row: AntreanRow;
        Insert: never; // hanya lewat RPC ambil_nomor_antrean
        Update: Partial<AntreanRow>;
        Relationships: [
          { foreignKeyName: "antrean_poli_id_fkey"; columns: ["poli_id"]; isOneToOne: false; referencedRelation: "polis"; referencedColumns: ["id"] },
          { foreignKeyName: "antrean_dokter_id_fkey"; columns: ["dokter_id"]; isOneToOne: false; referencedRelation: "dokters"; referencedColumns: ["id"] },
          { foreignKeyName: "antrean_jadwal_id_fkey"; columns: ["jadwal_id"]; isOneToOne: false; referencedRelation: "jadwal_praktik"; referencedColumns: ["id"] },
          { foreignKeyName: "antrean_pasien_id_fkey"; columns: ["pasien_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      kunjungan: {
        Row: {
          id: string; antrean_id: string; dokter_id: string; pasien_id: string; keluhan: string;
          tensi: string | null; suhu: number | null; berat: number | null; diagnosis: string;
          icd10: string | null; tindakan: string; resep: string; saran: string; created_at: string;
        };
        Insert: {
          id?: string; antrean_id: string; dokter_id: string; pasien_id: string; keluhan?: string;
          tensi?: string | null; suhu?: number | null; berat?: number | null; diagnosis?: string;
          icd10?: string | null; tindakan?: string; resep?: string; saran?: string; created_at?: string;
        };
        Update: {
          keluhan?: string; tensi?: string | null; suhu?: number | null; berat?: number | null; diagnosis?: string;
          icd10?: string | null; tindakan?: string; resep?: string; saran?: string;
        };
        Relationships: [
          { foreignKeyName: "kunjungan_antrean_id_fkey"; columns: ["antrean_id"]; isOneToOne: true; referencedRelation: "antrean"; referencedColumns: ["id"] },
          { foreignKeyName: "kunjungan_dokter_id_fkey"; columns: ["dokter_id"]; isOneToOne: false; referencedRelation: "dokters"; referencedColumns: ["id"] },
          { foreignKeyName: "kunjungan_pasien_id_fkey"; columns: ["pasien_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      audit_log: {
        Row: {
          id: number; actor_id: string | null; aksi: string; entitas: string;
          entitas_id: string | null; data: Json; created_at: string;
        };
        Insert: { actor_id: string; aksi: string; entitas: string; entitas_id?: string | null; data?: Json };
        Update: never;
        Relationships: [
          { foreignKeyName: "audit_log_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      ambil_nomor_antrean: {
        Args: { p_jadwal_id: string; p_tanggal: string; p_pasien_id?: string | null; p_sumber?: SumberAntrean };
        Returns: AntreanRow;
      };
      app_role: { Args: Record<string, never>; Returns: UserRole };
      batalkan_booking: { Args: { p_kode: string }; Returns: AntreanRow };
      kuota_terpakai: {
        Args: { p_dari: string; p_sampai: string };
        Returns: { jadwal_id: string; tanggal: string; terisi: number }[];
      };
      hari_ini_wib: { Args: Record<string, never>; Returns: string };
      laporan: {
        Args: { p_dari: string; p_sampai: string; p_poli_id?: string; p_dokter_id?: string };
        Returns: Json; // bentuknya: type Laporan di src/lib/laporan.ts
      };
      my_dokter_id: { Args: Record<string, never>; Returns: string };
      nik_tersamar: { Args: { p_profile_id: string }; Returns: string | null };
      set_nik: { Args: { p_profile_id: string; p_nik: string }; Returns: undefined };
    };
    Enums: {
      user_role: UserRole;
      jenis_kelamin: JenisKelamin;
      sumber_antrean: SumberAntrean;
      status_antrean: StatusAntrean;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
