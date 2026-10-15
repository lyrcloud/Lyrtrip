import { getSession } from '@/lib/auth';
import type { JobSubscription } from '@/lib/jobs';

export interface StudyEducation { school: string; qualification: string; field: string; grade: string; country: string; start: string; end: string }
export interface StudyTest { test: string; score: string; date: string }

export interface StudentProfile {
  id?: string;
  firstName: string; lastName: string; dateOfBirth: string; gender: string; nationality: string; countryOfResidence: string;
  city: string; address: string; email: string; phone: string; passportNumber: string; passportExpiry: string;
  studyLevel: string; fieldsOfStudy: string[]; preferredCountries: string[]; intake: string; budgetPerYear: string; fundingSource: string;
  education: StudyEducation[]; tests: StudyTest[]; englishWaiver: boolean; languages: string[]; workYears: number | null;
  goals: string; achievements: string; guardianName: string; guardianPhone: string;
}

export interface StudyDocType { id: string; label: string; for: ('admission' | 'scholarship')[]; images: boolean; waivable: boolean }

export interface StudyPlans {
  plans: { id: 'basic' | 'plus' | 'premium'; name: string; monthly: number; apps: number; perks: string[] }[];
  periods: { id: string; label: string; price: Record<string, number> }[];
  serviceRate: number;
  options: { levels: string[]; funding: string[]; tests: string[] };
  docs: StudyDocType[];
}

export interface StudyOwnerView {
  profile: StudentProfile | null;
  docs: Record<string, { name: string; uploadedAt: string; url: string | null }>;
  photoUrl: string | null;
  missing: { admission: string[]; scholarship: string[] };
  subscription: JobSubscription | null; live: boolean; appsUsed: number; appsLimit: number;
}

export type StudyAppStatus = 'submitted' | 'docs_needed' | 'fee_due' | 'processing' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

// An application made through Lyrtrip; the institution's website and contacts stay with Lyrtrip
export interface StudyApplication {
  id: string; type: 'admission' | 'scholarship'; institution: string; placeType: string | null; address: string; program: string; intake: string;
  status: StudyAppStatus; statusLabel: string; message: string;
  fee: { fee: number; service: number; total: number; label: string; paidAt: string | null } | null;
  createdAt: string; updatedAt: string;
}

export interface StudyApplyCheck {
  missing: string[]; name: string; email: string; studyLevel: string; fieldsOfStudy: string[]; intake: string;
  live: boolean; plan: string | null; appsUsed: number; appsLimit: number; serviceRate: number;
}

export const STUDY_STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-sky-100 text-sky-800', docs_needed: 'bg-orange-100 text-orange-800', fee_due: 'bg-amber-100 text-amber-900',
  processing: 'bg-indigo-100 text-indigo-800', applied: 'bg-indigo-100 text-indigo-800', interview: 'bg-amber-100 text-amber-900',
  offer: 'bg-emerald-100 text-emerald-800', rejected: 'bg-gray-200 text-gray-700', withdrawn: 'bg-gray-100 text-gray-500',
};

// Calls the study API, signed in when there is a session. Throws with the server's message.
export async function studyCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/study`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Uploads one document straight to storage with a signed form, then attaches it to the profile
export async function uploadStudyDoc(kind: string, file: File): Promise<StudyOwnerView> {
  const start = await studyCall<{ url: string; fields: Record<string, string>; key: string }>({ action: 'upload.start', kind, contentType: file.type, size: file.size });
  const form = new FormData();
  Object.entries(start.fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', file);
  const res = await fetch(start.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error('The upload failed. Please try again.');
  return studyCall<StudyOwnerView>({ action: 'upload.finish', kind, key: start.key, fileName: file.name });
}
