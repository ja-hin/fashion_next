'use client';

/** Shapes the browser receives from the API. */

export interface Me {
  authed: boolean;
  admin?: boolean;
  /** Public user id — "U0007". */
  uid?: string;
  provider?: 'gemini' | 'mock';
  version?: string;
  name?: string;
  email?: string;
  balance?: number;
  price?: number;
  styles?: string[];
  prices?: { imagine: Record<string, number>; saved: Record<string, number> };
  genie?: { free: number; price: number; max: number };
  /** On the free credits — generated images are served with the watermark. */
  watermark?: boolean;
}

export interface JobResult {
  pose: string;
  img?: string;
  cost?: number;
  warn?: string;
  error?: string;
}

export interface JobState {
  status: 'running' | 'done';
  total: number;
  done: number;
  results: JobResult[];
  product_id?: string;
  seed?: number;
  no?: number;
  shoot?: string;
  balance: number;
}

/** A rendered result card, plus the settings it was generated with (for Retry). */
export interface CardItem {
  pose: string;
  img: string;
  cost?: number;
  warn?: string;
  error?: string;
  isHero: boolean;
  file: string;
  settings: PoseSettings;
}

export interface PoseSettings {
  framing?: string;
  aspect?: string;
  backdrop?: string;
  mood?: string;
  lighting?: string;
  resolution?: string;
}

export interface GalleryItem {
  pid: string;
  seed: number;
  no: number;
  shoot: string;
  name: string;
  title: string;
  created: string;
  date: string;
  count: number;
  thumb: string;
  category: string;
  model: string;
  /** Admin-only — the server omits these for regular users. */
  owner_uid?: string;
  owner_email?: string;
}

export interface GalleryGroup {
  date: string;
  items: GalleryItem[];
}

export interface ModelRefPublic {
  file: string;
  pose: string;
  primary: boolean;
  charsheet: string;
  batch: string;
  url: string;
}

export interface SavedModel {
  id: string;
  name: string;
  created: string;
  source: string;
  source_shoot: string;
  tags: { ethnicity?: string; gender?: string; vibe?: string };
  thumb: string;
  ref_count: number;
  has_character_sheet: boolean;
  kept_batch: string;
  refs: ModelRefPublic[];
  /** Admin-only — the server omits these for regular users. */
  owner_uid?: string;
  owner_email?: string;
}

export interface ShootImage {
  pose: string;
  url: string;
  dlurl: string;
  dl: string;
}

export interface ResumeImage {
  file: string;
  pose: string;
  img: string;
  is_hero: boolean;
  aspect: string;
  framing: string;
  backdrop: string;
  mood: string;
  lighting: string;
}

export interface ResumePayload {
  pid: string;
  seed: number;
  no: number;
  shoot: string;
  name: string;
  title: string;
  style: string;
  hero_exists: boolean;
  images: ResumeImage[];
}

export interface LogRow {
  ts: string;
  /** Public user id of whoever generated this row — resolved server-side. */
  uid?: string;
  /** Owner email. Present for admins; a user's own rows are all their own. */
  user?: string;
  type: string;
  pid?: string;
  shoot?: string;
  seed?: number | string;
  pose?: string;
  category?: string;
  model?: string;
  status: string;
  cost: number;
  file?: string;
  img?: string;
  ai_model?: string;
  in_tok?: number;
  out_tok?: number;
  tot_tok?: number;
  usd?: number;
}

export interface LogsPayload {
  rows: LogRow[];
  models: string[];
  is_admin?: boolean;
  summary: {
    images: number;
    credits: number;
    genie: number;
    tokens: number;
    usd: number;
  };
}

export interface AdminUser {
  id: string;
  /** Public user id shown in the UI — "U0007". Blank on un-backfilled rows. */
  uid: string;
  email: string;
  name: string;
  is_admin: boolean;
  balance: number;
  created: string;
  active: boolean;
}

/** One image in the lightbox carousel. */
export interface LbItem {
  url: string;
  dl?: string;
  name?: string;
  pose?: string;
}

export interface CharsheetPromptInfo {
  prompt: string;
  ref_count: number;
  cost: number;
  cost_per_image: number;
  num_images: number;
  balance: number;
}