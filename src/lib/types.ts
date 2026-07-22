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
