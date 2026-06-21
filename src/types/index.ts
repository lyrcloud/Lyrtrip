export interface TrainStation {
  name: string;
  code: string;
  tz: string;
  bus: boolean;
  schArr: string;
  schDep: string;
  arr?: string;      // actual arrival (set once train arrives)
  dep?: string;      // actual departure (set once train departs)
  arrCmnt?: string;  // e.g. "5 Minutes Late"
  depCmnt?: string;
  status: string;
  platform?: string;
}

export interface TrainData {
  routeName: string;
  trainNum: string;
  trainID: string;
  lat: number;
  lon: number;
  heading: string;
  velocity: number;
  trainState: string;
  trainTimely: string;
  statusMsg: string;
  eventCode: string;
  eventName?: string;
  destCode: string;
  destName?: string;
  origCode: string;
  origName?: string;
  originTZ: string;
  updatedAt: string;
  lastValTS: string;
  alerts: string[];
  stations: TrainStation[];
}

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