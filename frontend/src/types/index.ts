export type SupportedLang = 'fr' | 'en' | 'zh';

export type UserRole = 'client' | 'operator' | 'admin';

export interface User {
  id?: string;
  _id?: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  role: UserRole;
  gender?: string;
  badge_secret?: string | null;
  client_code?: string | null;
  assigned_entrepot_id?: string | null;
  assigned_entrepot_name?: string | null;
  active_entrepot_id?: string | null;
  active_entrepot_name?: string | null;
  default_delivery_address?: string | null;
  avatar_url?: string | null;
  preferred_language?: SupportedLang;
  notification_preferences?: Record<string, boolean>;
}

export type TransportMode = 'sea' | 'air' | 'air_express';

export type ColisStatus =
  | 'draft'
  | 'pending_reception'
  | 'received'
  | 'damaged'
  | 'quoted'
  | 'grouped'
  | 'loaded'
  | 'loading'
  | 'closed'
  | 'departed'
  | 'in_transit'
  | 'arrived'
  | 'distributed'
  | 'delivered';

export interface Dimensions {
  l: number;
  w: number;
  h: number;
}

export interface TimelineStep {
  status: ColisStatus | string;
  label: string;
  timestamp: string;
  location?: string | null;
  operator?: string | null;
}

export interface Colis {
  id: string;
  tracking_number: string;
  owner_id: string;
  status: ColisStatus;
  supplier_name?: string | null;
  platform?: string | null;
  order_ref?: string | null;
  description: string;
  category: string;
  declared_value: number;
  currency: string;
  transport_mode: TransportMode;
  delivery_address?: string | null;
  insurance_enabled: boolean;
  instructions?: string | null;
  payment_status: 'pending' | 'waiting_validation' | 'paid' | 'rejected' | string;
  payment_proof_url?: string | null;
  invoice_status: 'none' | 'draft' | 'final' | string;
  invoice_id?: string | null;
  photos: string[];
  weight_real: number;
  weight_volumetric: number;
  dimensions: Dimensions;
  nature?: string | null;
  warehouse_location?: string | null;
  current_entrepot_id?: string | null;
  current_entrepot_name?: string | null;
  warehouse_history?: Array<Record<string, unknown>>;
  total_price: number;
  include_vat: boolean;
  timeline: TimelineStep[];
  container_id?: string | null;
  container_number?: string | null;
  groupage_id?: string | null;
  estimated_arrival?: string | null;
  volume_m3?: number;
  created_at: string;
  updated_at: string;
}

export type GroupageStatus = 'open' | 'closed' | 'in_transit' | 'arrived' | 'distributed';

export interface Groupage {
  id: string;
  container_number?: string;
  mode?: TransportMode;
  transport_mode?: TransportMode;
  vessel_name?: string | null;
  origin_port?: string | null;
  origin_city?: string | null;
  destination_port?: string | null;
  destination_city?: string;
  departure_date?: string | null;
  estimated_arrival?: string | null;
  total_price?: number;
  include_vat?: boolean;
  invoice_status?: string;
  status?: GroupageStatus | string;
  packages_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AppNotification {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  type?: string;
  read?: boolean;
  created_at?: string;
  data?: Record<string, unknown>;
}
