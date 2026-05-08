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

const missingFirebaseEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
].filter((k) => !(import.meta as any).env?.[k]);

if (missingFirebaseEnvKeys.length) {
  // Fail fast with a clear error instead of Firebase throwing auth/invalid-api-key later.
  const msg =
    `[Firebase] Missing environment variables: ${missingFirebaseEnvKeys.join(", ")}. ` +
    `Create ".env.local" (copy from ".env.example") and fill your Firebase web config.`;
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

