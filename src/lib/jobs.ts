import { getSession } from '@/lib/auth';

export interface Experience { title: string; company: string; location: string; start: string; end: string; current: boolean; description: string }
export interface Education { school: string; degree: string; field: string; start: string; end: string }

export interface JobProfile {
  id?: string;
  firstName: string; lastName: string; headline: string; city: string; country: string; email: string; phone: string;
  about: string; desiredRoles: string[]; jobTypes: string[]; workModes: string[]; yearsExperience: number | null;
  skills: string[]; languages: string[]; availability: string; willingToRelocate: boolean; openToWork: boolean; firstJob: boolean;
  workAuthorization: string; expectedSalary: string; links: { linkedin: string; portfolio: string; github: string };
  experience: Experience[]; education: Education[]; cvName?: string;
}

export interface JobSubscription {
  plan: 'basic' | 'plus' | 'premium'; period: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean;
}

export interface JobPlans {
  plans: { id: 'basic' | 'plus' | 'premium'; name: string; monthly: number; perks: string[] }[];
  periods: { id: string; label: string; price: Record<string, number> }[];
  options: { jobTypes: string[]; workModes: string[]; availability: string[] };
}

export interface OwnerView {
  profile: JobProfile | null; photoUrl: string | null; cvUrl: string | null; hasPhoto: boolean; hasCv: boolean;
  missing: string[]; listed: boolean; hidden: boolean; subscription: JobSubscription | null; live: boolean; companyViews: number;
}

export interface TalentCard {
  id: string; name: string; headline: string; city: string; country: string; photoUrl: string | null; skills: string[];
  desiredRoles: string[]; jobTypes: string[]; workModes: string[]; yearsExperience: number | null; availability: string;
  openToWork: boolean; plan: string | null; featured: boolean;
}

export interface TalentProfile extends TalentCard {
  about: string; languages: string[]; experience: Experience[]; education: Education[]; links: Record<string, string>;
  willingToRelocate: boolean; workAuthorization: string; firstJob: boolean;
  contact: { email: string; phone: string; expectedSalary: string; cvUrl: string | null; cvName: string | null } | null;
}

// Calls the job profile API, signed in when there is a session. Throws with the server's message.
export async function jobsCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Uploads a photo or CV straight to storage with a signed form, then attaches it to the profile
export async function uploadJobFile(kind: 'photo' | 'cv', file: File): Promise<OwnerView> {
  const start = await jobsCall<{ url: string; fields: Record<string, string>; key: string }>({ action: 'upload.start', kind, contentType: file.type, size: file.size });
  const form = new FormData();
  Object.entries(start.fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', file);
  const res = await fetch(start.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error('The upload failed. Please try again.');
  return jobsCall<OwnerView>({ action: 'upload.finish', kind, key: start.key, fileName: file.name });
}

export const PLAN_STYLE: Record<string, string> = {
  basic: 'bg-gray-100 text-gray-700', plus: 'bg-sky-100 text-sky-800', premium: 'bg-amber-100 text-amber-900',
};
