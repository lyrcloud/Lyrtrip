import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'your_key',
  authDomain: 'your_domain',
  projectId: 'your_project_id',
  storageBucket: 'your_bucket',
  messagingSenderId: 'your_sender_id',
  appId: 'your_app_id',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);