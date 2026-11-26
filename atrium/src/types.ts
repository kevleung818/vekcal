export type Role = "guest" | "member" | "professional" | "reviewer" | "brand";

export type Topic = "Skin" | "Nutrition" | "Everyday care" | "How care works";

export interface Professional {
  id: string;
  name: string;
  credential: string;
  registration: string;
  field: string;
  philosophy: string;
  clinic: string;
  district: string;
  bookingUrl: string;
  advanced: boolean;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  authorId: string;
  topic: Topic;
  status: "published" | "pending" | "rejected";
  reviewNote: string;
  conflictNote: string;
  reads: number;
}

export interface Comment {
  id: string;
  articleId: string;
  authorLabel: string;
  role: "member" | "professional";
  professionalId?: string;
  body: string;
  createdAt: string;
}

export interface Question {
  id: string;
  title: string;
  body: string;
  askerLabel: string;
  status: "open" | "answered";
  answer: string;
  answeredBy: string;
  createdAt: string;
}

export interface Placement {
  id: string;
  brand: string;
  kind: "Advertisement" | "Sponsored" | "Listing";
  title: string;
  body: string;
  status: "live" | "pending" | "rejected";
}

export interface Report {
  id: string;
  target: string;
  detail: string;
  status: "open" | "handled";
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  label: string;
  delta: number;
  createdAt: string;
}

export interface AppState {
  role: Role;
  actingProfessionalId: string;
  subscribed: boolean;
  vouchers: number;
  articles: Article[];
  comments: Comment[];
  questions: Question[];
  placements: Placement[];
  reports: Report[];
  ledger: LedgerEntry[];
  tipped: string[];
  balances: Record<string, number>;
  redeemedBy: Record<string, string[]>;
  donatedBy: Record<string, number>;
  badgeBy: Record<string, boolean>;
  advancedOn: boolean;
}
