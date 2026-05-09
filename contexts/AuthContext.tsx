import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, DATABASE_URL_BASE } from "../firebase";
import { UserProfile, UserRole } from "../types";
import { isAdmin } from "../config/admins";
import { supabase, supabaseAdmin } from "../supabase";

const USERS_URL = `${DATABASE_URL_BASE}/datasheet/Users.json`;
const TEACHERS_URL = `${DATABASE_URL_BASE}/datasheet/Gi%C3%A1o_vi%C3%AAn.json`;
const STUDENTS_URL = `${DATABASE_URL_BASE}/datasheet/Danh_s%C3%A1ch_h%E1%BB%8Dc_sinh.json`;

// Session storage keys
const STORAGE_KEYS = {
  CURRENT_USER: "tritue8_current_user",
  USER_PROFILE: "tritue8_user_profile",
  NEEDS_ONBOARDING: "tritue8_needs_onboarding",
  AUTH_PERSISTENCE: "tritue8_auth_persistence",
} as const;

// Helper functions for local storage (changed from session storage)
const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("⚠️ Failed to save to local storage:", error);
  }
};

const loadFromStorage = <T,>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.warn("⚠️ Failed to load from local storage:", error);
    return null;
  }
};

const clearStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach((key) =>
      localStorage.removeItem(key)
    );
  } catch (error) {
    console.warn("⚠️ Failed to clear local storage:", error);
  }
};

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  needsOnboarding: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithTeacherCredentials: (
    email: string,
    password: string
  ) => Promise<void>;
  signInWithParentCredentials: (
    studentCode: string,
    password: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (fullName: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Don't load User object from localStorage - it's not serializable
    // Instead, we'll rely on userProfile and onAuthStateChanged
    return null;
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    // Initialize from local storage
    return loadFromStorage<UserProfile>(STORAGE_KEYS.USER_PROFILE);
  });
  const [needsOnboarding, setNeedsOnboarding] = useState(() => {
    // Initialize from local storage
    return loadFromStorage<boolean>(STORAGE_KEYS.NEEDS_ONBOARDING) || false;
  });
  const [loading, setLoading] = useState(() => {
    const storedProfile = loadFromStorage<UserProfile>(STORAGE_KEYS.USER_PROFILE);
    return !storedProfile; // If we have a stored profile, we don't need to wait for onAuthStateChanged
  });

  // Use refs to prevent infinite loops and race conditions
  const isFetchingRef = useRef<string | null>(null);
  const profileRef = useRef<UserProfile | null>(userProfile);

  // Update profile ref whenever userProfile changes
  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  // Helper to compare profiles and avoid redundant updates
  const isProfileSame = (newProfile: UserProfile | null, oldProfile: UserProfile | null) => {
    if (!newProfile && !oldProfile) return true;
    if (!newProfile || !oldProfile) return false;
    
    // Check key fields
    const keysToCompare: (keyof UserProfile)[] = [
      "uid", "email", "role", "displayName", "teacherId", "studentId", "position", "isAdmin"
    ];
    
    return keysToCompare.every(key => newProfile[key] === oldProfile[key]);
  };

  // Fetch or create user profile
  const fetchUserProfile = async (user: User): Promise<UserProfile | null> => {
    // Prevent concurrent fetches for the same user
    if (isFetchingRef.current === user.email) {
      console.log("⏳ Fetch already in progress for:", user.email);
      return profileRef.current;
    }

    try {
      isFetchingRef.current = user.email;
      console.log("⏳ Fetching user profile for:", user.email);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(USERS_URL, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        console.error("❌ Failed to fetch users:", response.status);
        isFetchingRef.current = null;
        return null;
      }

      const data = await response.json();
      console.log("✅ Fetched users data:", Object.keys(data || {}).length, "users");
      // Find existing user profile
      let profile: UserProfile | null = null;
      if (data) {
        const existingProfile = Object.entries(data).find(
          ([_, profile]: [string, any]) => profile.email === user.email
        );

        if (existingProfile) {
          const [id, profileData] = existingProfile;
          profile = { ...(profileData as UserProfile), uid: id };
        }
      }

      // Create new user profile if not exists
      if (!profile) {
        const role: UserRole = isAdmin(user.email) ? "admin" : "teacher";
        const newProfile: Omit<UserProfile, "uid"> = {
          email: user.email!,
          role,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        console.log("📝 Creating new user profile:", {
          email: user.email,
          role,
        });

        const createController = new AbortController();
        const createTimeout = setTimeout(() => createController.abort(), 8000);

        const createResponse = await fetch(USERS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newProfile),
          signal: createController.signal,
        });
        clearTimeout(createTimeout);

        if (createResponse.ok) {
          const result = await createResponse.json();
          profile = { ...newProfile, uid: result.name };
        } else {
          isFetchingRef.current = null;
          return null;
        }
      }

      // Fetch teacher position from Giáo_viên table
      try {
        const teachersController = new AbortController();
        const teachersTimeout = setTimeout(() => teachersController.abort(), 8000);

        const teachersResponse = await fetch(TEACHERS_URL, { signal: teachersController.signal });
        clearTimeout(teachersTimeout);

        if (!teachersResponse.ok) {
          console.warn("⚠️ Failed to fetch teachers:", teachersResponse.status);
          isFetchingRef.current = null;
          return profile;
        }

        const teachersData = await teachersResponse.json();
        console.log("✅ Fetched teachers data:", Object.keys(teachersData || {}).length, "teachers");

        if (teachersData) {
          const teacherEntry = Object.entries(teachersData).find(
            ([_, teacher]: [string, any]) =>
              teacher.Email === user.email ||
              teacher["Email công ty"] === user.email
          );

          if (teacherEntry) {
            const [teacherId, teacherData]: [string, any] = teacherEntry;
            const position = teacherData["Vị trí"] || "";

            // Check admin status: either by position OR by email in admin list
            const isAdminByPosition = position === "Admin";
            const isAdminByEmail = isAdmin(user.email); // Using the function from config/admins.ts
            const finalIsAdmin = isAdminByPosition || isAdminByEmail;

            // BẮT BUỘC ĐỒNG BỘ ROLE VÀ ISADMIN
            // Nếu không phải admin thực sự, ép về role "teacher" để tránh bị kẹt role cũ
            const finalRole = finalIsAdmin ? "admin" : "teacher";

            // Update profile with position info
            profile = {
              ...profile,
              teacherId,
              position,
              isAdmin: finalIsAdmin,
              role: finalRole,
            };

            console.log("✅ User profile loaded with position:", {
              email: user.email,
              position: position,
              isAdmin: finalIsAdmin,
            });
          } else {
            // If no teacher entry found, fallback to email-based admin check
            const isAdminByEmail = isAdmin(user.email);
            profile = {
              ...profile,
              isAdmin: isAdminByEmail,
            };
            console.log(
              "⚠️ No teacher entry found, using email-based admin check:",
              { email: user.email, isAdmin: isAdminByEmail }
            );
          }
        }
      } catch (error) {
        console.warn("⚠️ Could not fetch teacher position:", error);
      }

      isFetchingRef.current = null;
      return profile;
    } catch (error) {
      isFetchingRef.current = null;
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("⏱️ Timeout fetching user profile (8s):", user.email);
        return null;
      }
      console.error("❌ Error fetching user profile:", error);
      return null;
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    saveToStorage(STORAGE_KEYS.AUTH_PERSISTENCE, true);

    const storedProfile = loadFromStorage<UserProfile>(STORAGE_KEYS.USER_PROFILE);
    
    let unsubscribe = () => {};
    if (auth) {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!isSubscribed) return;
        console.log('🔐 Auth state changed:', { user: user?.email || 'null', uid: user?.uid || 'null' });
        setCurrentUser(user);

        if (user) {
          console.log("👤 User logged in:", user.email);
          try {
            const profile = await fetchUserProfile(user);
            if (!isSubscribed) return;

            if (!isProfileSame(profile, profileRef.current)) {
              console.log("🔄 Updating user profile state");
              setUserProfile(profile);
              saveToStorage(STORAGE_KEYS.USER_PROFILE, profile);
            }

            if (profile && profile.role === "teacher" && !profile.teacherId) {
              setNeedsOnboarding(true);
              saveToStorage(STORAGE_KEYS.NEEDS_ONBOARDING, true);
            } else {
              setNeedsOnboarding(false);
              saveToStorage(STORAGE_KEYS.NEEDS_ONBOARDING, false);
            }
          } catch (error) {
            console.error("❌ Error loading profile:", error);
            setUserProfile(null);
            setNeedsOnboarding(false);
          }
        } else {
          console.log("👤 User logged out or no Firebase user");
          const stored = loadFromStorage<UserProfile>(STORAGE_KEYS.USER_PROFILE);
          if (stored) {
            setUserProfile(stored);
            setCurrentUser({
              uid: stored.uid,
              email: stored.email,
              emailVerified: true,
              displayName: stored.displayName || undefined,
            } as User);

            if (stored.role === "admin" || stored.role === "teacher") {
              import("@/utils/supabaseHelpers").then(async ({ supabaseGetAll }) => {
                try {
                  const data = await supabaseGetAll("datasheet/Giáo_viên", true);
                  if (data) {
                    const entry = Object.entries(data).find(([_, t]: [string, any]) => t.Email === stored.email || t["Email công ty"] === stored.email);
                    if (entry) {
                      const [_, tData] = entry as [string, any];
                      const isActuallyAdmin = tData.vi_tri === "Admin" || tData["Vị trí"] === "Admin" || isAdmin(stored.email);
                      const correctRole = isActuallyAdmin ? "admin" : "teacher";
                      if (stored.isAdmin !== isActuallyAdmin || stored.role !== correctRole) {
                        const updated = { ...stored, isAdmin: isActuallyAdmin, role: correctRole };
                        setUserProfile(updated);
                        saveToStorage(STORAGE_KEYS.USER_PROFILE, updated);
                      }
                    }
                  }
                } catch (err) {}
              });
            }
            setNeedsOnboarding(stored.role === "teacher" && !stored.teacherId);
          } else {
            setUserProfile(null);
            setNeedsOnboarding(false);
            if (!loadFromStorage(STORAGE_KEYS.AUTH_PERSISTENCE)) clearStorage();
          }
        }
        if (isSubscribed) setLoading(false);
      });
    } else {
      console.warn("⚠️ Firebase Auth not initialized.");
      setLoading(false);
    }

    return () => { isSubscribed = false; unsubscribe(); };
  }, []);

  const signUpWithEmail = async (email: string, password: string) => {
    if (!auth) throw new Error("Hệ thống đăng ký chưa cấu hình.");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
    } catch (error) { throw error; }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!auth) return signInWithTeacherCredentials(email, password);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) console.warn("⚠️ Email not verified");
    } catch (error) { throw error; }
  };

  const signInWithTeacherCredentials = async (email: string, password: string) => {
    try {
      const { data: teachers, error } = await supabaseAdmin.from("giao_vien").select("*");
      if (error) throw error;
      const t = teachers.find((x: any) => (x.email || x.Email || x["Email công ty"] || "").toLowerCase() === email.toLowerCase() && (x.password || x.Password) === password);
      if (!t) throw new Error("Invalid email or password");
      const mockUser = { uid: t.id, email: t.email || t.Email, emailVerified: true, displayName: t.ten_giao_vien || t["Họ và tên"] } as User;
      const isAdm = t.vi_tri === "Admin" || t["Vị trí"] === "Admin" || isAdmin(mockUser.email!);
      const profile = { uid: mockUser.uid, email: mockUser.email!, displayName: mockUser.displayName!, role: isAdm ? "admin" : "teacher", isAdmin: isAdm, createdAt: new Date().toISOString() };
      setCurrentUser(mockUser);
      setUserProfile(profile);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, mockUser);
      saveToStorage(STORAGE_KEYS.USER_PROFILE, profile);
    } catch (error) { throw error; }
  };

  const signInWithParentCredentials = async (studentCode: string, password: string) => {
    try {
      const { data: students, error } = await supabaseAdmin.from("hoc_sinh").select("*");
      if (error) throw error;
      const s = students.find((x: any) => (x.ma_hoc_sinh || x["Mã học sinh"] || "").toString().trim() === studentCode.trim() && (x.password || x.mat_khau || x["Mật khẩu"]) === password);
      if (!s) throw new Error("Invalid student code or password");
      const mockUser = { uid: s.id, email: `${studentCode}@parent.com`, emailVerified: true, displayName: s.ten_hoc_sinh || s["Họ và tên"] } as User;
      const profile = { uid: mockUser.uid, email: mockUser.email!, displayName: mockUser.displayName!, role: "parent", isAdmin: false, studentId: s.id, createdAt: new Date().toISOString() };
      setCurrentUser(mockUser);
      setUserProfile(profile);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, mockUser);
      saveToStorage(STORAGE_KEYS.USER_PROFILE, profile);
    } catch (error) { throw error; }
  };
  const signOut = async () => {
    try {
      console.log("🚪 Signing out");
      // Mark as intentional logout before clearing storage
      localStorage.removeItem(STORAGE_KEYS.AUTH_PERSISTENCE);

      // IMPORTANT: if there is an active Firebase session, we must sign out.
      if (auth && auth.currentUser) {
        await firebaseSignOut(auth);
      }

      // Clear local state/storage (covers teacher/parent mock auth too)
      setCurrentUser(null);
      setUserProfile(null);
      setNeedsOnboarding(false);
      clearStorage();

      console.log("👋 Logged out");
    } catch (error) {
      console.error("❌ Logout error:", error);
      throw error;
    }
  };

  const completeOnboarding = async (fullName: string) => {
    if (!currentUser || !userProfile) {
      throw new Error("No user logged in");
    }

    try {
      console.log("🎓 Starting teacher onboarding:", {
        fullName,
        email: currentUser.email,
      });

      // 1. Create teacher record in Giáo_viên
      const teacherData = {
        "Họ và tên": fullName,
        Email: currentUser.email,
        "Biên chế": "Mới",
        "Ngày tạo": new Date().toISOString(),
      };

      const teacherResponse = await fetch(TEACHERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teacherData),
      });

      if (!teacherResponse.ok) {
        throw new Error("Failed to create teacher record");
      }

      const teacherResult = await teacherResponse.json();
      const teacherId = teacherResult.name;
      console.log("✅ Teacher record created:", teacherId);

      // 2. Update user profile with teacherId
      const userUpdateUrl = `${DATABASE_URL_BASE}/Users/${userProfile.uid}.json`;
      const updateResponse = await fetch(userUpdateUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          updatedAt: new Date().toISOString(),
        }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update user profile");
      }

      console.log("✅ User profile updated with teacherId");

      // 3. Update local state
      setUserProfile({
        ...userProfile,
        teacherId,
        updatedAt: new Date().toISOString(),
      });
      setNeedsOnboarding(false);

      // Save to session storage
      const updatedProfile = {
        ...userProfile,
        teacherId,
        updatedAt: new Date().toISOString(),
      };
      saveToStorage(STORAGE_KEYS.USER_PROFILE, updatedProfile);
      saveToStorage(STORAGE_KEYS.NEEDS_ONBOARDING, false);

      console.log("🎉 Onboarding completed successfully");
    } catch (error) {
      console.error("❌ Onboarding error:", error);
      throw error;
    }
  };

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    needsOnboarding,
    signUpWithEmail,
    signInWithEmail,
    signInWithTeacherCredentials,
    signInWithParentCredentials,
    signOut,
    completeOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
