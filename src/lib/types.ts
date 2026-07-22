export type Stand = {
  id: string;
  title: string;
  title_hi: string | null;
  description: string;
  description_hi: string | null;
  category: string;
  status: string;
  created_at: string;
};

export type Counts = { total: number; today: number };

export type WallEntry = {
  stand_id: string;
  first_name: string;
  state: string | null;
  created_at: string;
};

export type StateRow = { stand_id: string; state: string; count: number };

export type Profile = {
  id: string;
  first_name: string;
  state: string | null;
  show_on_wall: boolean;
};

export type FeedItem = {
  id: string;
  url: string;
  platform: 'youtube' | 'x' | 'instagram';
  title: string | null;
  author_name: string | null;
  thumbnail_url: string | null;
  issue: string;
  state: string | null;
  /** 'state' = tagged to one state; 'national' = All India (shows on every tile). */
  scope?: 'state' | 'national';
  status: string;
  flagged?: boolean;
  reports?: number;
  submitted_on: string;
  approved_at: string | null;
};
