// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Firebase config từ environment variables (.env.local)
// Vite sẽ thay thế import.meta.env.VITE_* tại build time
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// IMPORTANT:
// In Vite production builds, `import.meta.env.VITE_*` is statically replaced,
// but dynamic access like `import.meta.env[key]` is NOT guaranteed to work.
// So we validate using the resolved config values instead of checking env by key.
const firebaseRequiredConfig: Record<string, unknown> = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_DATABASE_URL: firebaseConfig.databaseURL,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
};

const missingFirebaseEnvKeys = Object.entries(firebaseRequiredConfig)
  .filter(([_, v]) => !v)
  .map(([k]) => k);

if (missingFirebaseEnvKeys.length) {
  // Fail fast with a clear error instead of Firebase throwing auth/invalid-api-key later.
  const msg =
    `[Firebase] Missing environment variables: ${missingFirebaseEnvKeys.join(", ")}. ` +
    `Check your Vite env files (.env / .env.local / .env.${import.meta.env.MODE}).`;
  // eslint-disable-next-line no-console
  console.error(msg);
  throw new Error(msg);
}

// Export DATABASE_URL từ config (dùng cho scripts và REST API calls)
export const DATABASE_URL_BASE = firebaseConfig.databaseURL;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Set auth persistence to local storage (persist across browser sessions)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("⚠️ Failed to set Firebase auth persistence:", error);
});

export const database = getDatabase(app);
export const storage = getStorage(app);

// Export app as both named and default for flexibility
export { app };
export default app;

