
export interface Airfield {
  id: string;
  name: string;
  location: string;
  coordinates: string;
  description: string;
  isActive: boolean;
}

export type Theme = 'light' | 'dark';

export type BallisticDirection = string;

export interface Channel {
  id: string;
  name: string;
  avatarUrl?: string;
  adminId: string;
  members: string[]; // User IDs
  writeAccess: 'admin_only' | 'all_members';
  passcode?: string; // 4 digits
  createdAt: any;
}