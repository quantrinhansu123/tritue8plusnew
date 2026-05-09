// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Firebase configuration with safety checks
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

// Export DATABASE_URL từ config (dùng cho scripts và REST API calls)
export const DATABASE_URL_BASE = firebaseConfig.databaseURL || "";

// Initialize Firebase safely
let app: any = null;
let auth: any = null;
let database: any = null;
let storage: any = null;

try {
  // Only initialize if API Key is present and valid
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "undefined") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    storage = getStorage(app);
    
    // Set persistence only if auth is initialized
    if (auth) {
      setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.warn("Firebase persistence error:", err);
      });
    }
  } else {
    console.warn("⚠️ Firebase API Key missing. Firebase services will be unavailable.");
  }
} catch (error) {
  console.error("❌ Failed to initialize Firebase:", error);
}

// Export initialized or mock services
export { auth, database, storage, app };
export default app;

