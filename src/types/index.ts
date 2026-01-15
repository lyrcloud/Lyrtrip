/**
 * Tour type definition
 */
export interface Tour {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

/**
 * Tour creation payload (without auto-generated fields)
 */
export type CreateTourInput = Omit<Tour, 'id' | 'user_id' | 'created_at' | 'updated_at'>;