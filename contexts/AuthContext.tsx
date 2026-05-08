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

    // Mark auth persistence in storage
    saveToStorage(STORAGE_KEYS.AUTH_PERSISTENCE, true);

    // Restore currentUser from userProfile if available (for teacher/parent auth)
    const storedProfile = loadFromStorage<UserProfile>(STORAGE_KEYS.USER_PROFILE);
    if (storedProfile && !currentUser) {
      // Create minimal user object from profile
      const restoredUser = {
        uid: storedProfile.uid,
        email: storedProfile.email,
        emailVerified: true,
        displayName: storedProfile.displayName || undefined,
      } as User;
      setCurrentUser(restoredUser);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isSubscribed) return;

      console.log('🔐 Auth state changed:', { user: user?.email || 'null', uid: user?.uid || 'null' });

      setCurrentUser(user);
      // Don't save User object to localStorage - it's not serializable
      // saveToStorage(STORAGE_KEYS.CURRENT_USER, user);

      if (user) {
        console.log("👤 User logged in:", user.email);
        try {
          const profile = await fetchUserProfile(user);
          if (!isSubscribed) return;

          // Only update state if profile has actually changed to prevent re-render loops
          if (!isProfileSame(profile, profileRef.current)) {
            console.log("🔄 Updating user profile state (data changed)");
            setUserProfile(profile);
            saveToStorage(STORAGE_KEYS.USER_PROFILE, profile);
          } else {
            console.log("ℹ️ Skipping profile update (data identical)");
          }

          // Check if teacher needs onboarding
          if (profile && profile.role === "teacher" && !profile.teacherId) {
            console.log("🎓 Teacher needs onboarding");
            setNeedsOnboarding(true);
            saveToStorage(STORAGE_KEYS.NEEDS_ONBOARDING, true);
          } else {
            setNeedsOnboarding(false);
            saveToStorage(STORAGE_KEYS.NEEDS_ONBOARDING, false);
          }
        } catch (error) {
          console.error("❌ Error loading user profile:", error);
          setUserProfile(null);
          setNeedsOnboarding(false);
          saveToStorage(STORAGE_KEYS.USER_PROFILE, null);
          saveToStorage(STORAGE_KEYS.NEEDS_ONBOARDING, false);
        }
      } else {
        console.log("👤 User logged out or no Firebase user");
        // Check if we have a stored profile (for teacher/parent mock auth)
        const storedProfile = loadFromStorage<UserProfile>(STORAGE_KEYS.USER_PROFILE);
        if (storedProfile) {
          // If we have a stored profile but no Firebase user, this might be:
          // 1. Teacher/Parent login (mock user) - keep the profile
          // 2. Page refresh with teacher/parent login - restore the profile
          console.log("📦 Restoring stored profile (teacher/parent login):", storedProfile.email);
          setUserProfile(storedProfile);

          // Restore currentUser from stored profile
          const restoredUser = {
            uid: storedProfile.uid,
            email: storedProfile.email,
            emailVerified: true,
            displayName: storedProfile.displayName || undefined,
          } as User;
          setCurrentUser(restoredUser);

          // XÁC THỰC LẠI QUYỀN HẠN NGẦM (RE-VALIDATION)
          // Tránh việc giáo viên bị lưu quyền admin cũ trong localStorage mãi mãi
          if (storedProfile.role === "admin" || storedProfile.role === "teacher") {
            console.log("🔄 Background re-validating teacher permissions...");
            import("@/utils/supabaseHelpers").then(async ({ supabaseGetAll }) => {
              try {
                const data = await supabaseGetAll("datasheet/Giáo_viên", true); // force fetch
                if (data) {
                  const teacherEntry = Object.entries(data).find(
                    ([_, t]: [string, any]) => t.Email === storedProfile.email || t["Email công ty"] === storedProfile.email
                  );
                  
                  if (teacherEntry) {
                    const [_, teacherData] = teacherEntry as [string, any];
                    const isActuallyAdmin = teacherData.vi_tri === "Admin" || teacherData["Vị trí"] === "Admin" || isAdmin(storedProfile.email);
                    const correctRole = isActuallyAdmin ? "admin" : "teacher";
                    
                    if (storedProfile.isAdmin !== isActuallyAdmin || storedProfile.role !== correctRole) {
                      console.warn("⚠️ Permission mismatch detected! Auto-fixing profile.");
                      const updatedProfile = {
                        ...storedProfile,
                        isAdmin: isActuallyAdmin,
                        role: correctRole
                      };
                      setUserProfile(updatedProfile);
                      saveToStorage(STORAGE_KEYS.USER_PROFILE, updatedProfile);
                    } else {
                      console.log("✅ Permissions verified and correct.");
                    }
                  }
                }
              } catch (err) {
                console.error("❌ Failed to re-validate teacher:", err);
              }
            });
          }

          // Check onboarding status
          if (storedProfile.role === "teacher" && !storedProfile.teacherId) {
            setNeedsOnboarding(true);
          } else {
            setNeedsOnboarding(false);
          }
        } else {
          // No stored profile and no Firebase user = actual logout
          console.log("👤 Actual logout - clearing profile");
          setUserProfile(null);
          setNeedsOnboarding(false);
          // Only clear storage if this is an intentional logout, not a page refresh
          const authPersistence = loadFromStorage<boolean>(STORAGE_KEYS.AUTH_PERSISTENCE);
          if (!authPersistence) {
            clearStorage();
          }
        }
      }

      if (isSubscribed) {
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, []);

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      console.log("📝 Creating account with email:", email);

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Send email verification
      await sendEmailVerification(userCredential.user);

      console.log("✅ Account created. Verification email sent to:", email);
    } catch (error) {
      console.error("❌ Error creating account:", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("� Signing in with email:", email);

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        console.warn("⚠️ Email not verified");
        // You can choose to allow or block unverified users
        // For now, we'll allow but show a warning
      }

      console.log("✅ Sign in successful");
    } catch (error) {
      console.error("❌ Error signing in:", error);
      throw error;
    }
  };

  const signInWithTeacherCredentials = async (
    email: string,
    password: string
  ) => {
    try {
      console.log("🏫 Signing in with teacher credentials (Supabase):", email);

      // Fetch teachers from Supabase instead of Firebase
      // Use supabaseAdmin to bypass potential RLS issues during migration
      const { data: teachersData, error: sbError } = await supabaseAdmin
        .from("giao_vien")
        .select("*");

      if (sbError) {
        console.error("❌ Supabase fetch error:", sbError);
        throw new Error("Failed to fetch teachers from Supabase: " + sbError.message);
      }

      console.log("📊 Teachers found in DB:", teachersData?.length || 0);

      if (!teachersData || teachersData.length === 0) {
        throw new Error("No teachers found in database (Table: giao_vien)");
      }

      // Find teacher by email and password
      // Note: Supabase columns are usually snake_case or as created. 
      // Based on the screenshot and common patterns: email, password or "Email", "Password"
      const teacher = teachersData.find((t: any) => {
        const teacherEmail = t.email || t.Email || t["Email công ty"] || "";
        const teacherPassword = t.password || t.Password || "";
        return (
          teacherEmail.toLowerCase() === email.toLowerCase() &&
          teacherPassword === password
        );
      });

      if (!teacher) {
        throw new Error("Invalid email or password");
      }

      const teacherId = teacher.id;
      const teacherName = teacher.ten_giao_vien || teacher["Họ và tên"] || teacher.ho_ten || "";

      // Create a mock user object for teacher login
      const mockUser = {
        uid: teacherId,
        email: teacher.email || teacher.Email || teacher["Email công ty"],
        emailVerified: true,
        displayName: teacherName,
      } as User;

      // Create user profile
      const isActuallyAdmin = teacher.vi_tri === "Admin" || teacher["Vị trí"] === "Admin" || isAdmin(mockUser.email!);
      
      const profile: UserProfile = {
        uid: mockUser.uid,
        email: mockUser.email!,
        displayName: teacherName,
        role: isActuallyAdmin ? "admin" : "teacher",
        isAdmin: isActuallyAdmin,
        createdAt: new Date().toISOString(),
      };

      // Set the current user and profile directly (bypassing Firebase Auth)
      setCurrentUser(mockUser);
      setUserProfile(profile);
      setNeedsOnboarding(false);

      // Save to local storage
      saveToStorage(STORAGE_KEYS.CURRENT_USER, mockUser);
      saveToStorage(STORAGE_KEYS.USER_PROFILE, profile);
      saveToStorage(STORAGE_KEYS.NEEDS_ONBOARDING, false);

      console.log("✅ Teacher sign in successful:", profile);
    } catch (error) {
      console.error("❌ Error signing in with teacher credentials:", error);
      throw error;
    }
  };

  const signInWithParentCredentials = async (
    studentCode: string,
    password: string
  ) => {
    try {
      console.log("👨‍👩‍👧 Signing in with parent credentials:", studentCode);

      // Fetch students from Supabase instead of Firebase
      const { data: studentsData, error: sbError } = await supabaseAdmin
        .from("hoc_sinh")
        .select("*");

      if (sbError) {
        throw new Error("Failed to fetch students from Supabase: " + sbError.message);
      }

      if (!studentsData || studentsData.length === 0) {
        throw new Error("No students found in database");
      }

      // Find student by student code and password
      const student = studentsData.find((s: any) => {
        // Handle both snake_case (Supabase) and PascalCase (Original)
        const code = (s.ma_hoc_sinh || s["Mã học sinh"] || s.code || "").toString().trim();
        const pwd = (s.password || s.mat_khau || s["Mật khẩu"] || "").toString().trim();
        
        return (
          code.toLowerCase() === studentCode.trim().toLowerCase() &&
          pwd === password.trim()
        );
      });

      if (!student) {
        throw new Error("Mã học sinh hoặc mật khẩu không đúng");
      }

      console.log("🔍 Found student for login:", { 
        id: student.id, 
        code: student.ma_hoc_sinh || student["Mã học sinh"] || student.code,
        hasPassword: !!(student.password || student.mat_khau || student["Mật khẩu"]),
        rawKeys: Object.keys(student)
      });

      const studentId = student.id;
      const studentName = student.ho_va_ten || student["Họ và tên"] || student.name || "";
      const studentCodeActual = student.ma_hoc_sinh || student["Mã học sinh"] || student.code || "";

      // Check if password is set
      const studentPassword = student.password || student.mat_khau || student["Mật khẩu"];
      if (!studentPassword && studentPassword !== 0) {
        console.warn("⚠️ Student password field is empty in DB:", student);
        throw new Error("Tài khoản chưa được kích hoạt. Vui lòng liên hệ nhà trường.");
      }

      // Check if student status is "Hủy" (cancelled)
      const studentStatus = student.trang_thai || student["Trạng thái"];
      if (studentStatus === "Hủy") {
        throw new Error("Tài khoản học sinh đã bị hủy. Vui lòng liên hệ với trung tâm để biết thêm chi tiết.");
      }

      // Create a mock user object for parent login
      const mockUser = {
        uid: `parent_${studentId}`,
        email: student.email || student["Email"] || `${studentCode}@parent.local`,
        emailVerified: true,
        displayName: `Phụ huynh ${studentName}`,
      } as User;

      // Create user profile for parent
      const profile: UserProfile = {
        uid: mockUser.uid,
        email: mockUser.email!,
        displayName: mockUser.displayName!,
        role: "parent" as UserRole,
        studentId: studentId,
        studentName: studentName,
        studentCode: studentCode,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      };

      // Set the current user and profile directly
      setCurrentUser(mockUser);
      setUserProfile(profile);
      setNeedsOnboarding(false);

      // Save to local storage
      saveToStorage(STORAGE_KEYS.CURRENT_USER, mockUser);
      saveToStorage(STORAGE_KEYS.USER_PROFILE, profile);
      saveToStorage(STORAGE_KEYS.NEEDS_ONBOARDING, false);

      console.log("✅ Parent sign in successful:", profile);
    } catch (error) {
      console.error("❌ Error signing in with parent credentials:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log("🚪 Signing out");

      // Mark as intentional logout before clearing storage
      // (this is used by the onAuthStateChanged handler)
      localStorage.removeItem(STORAGE_KEYS.AUTH_PERSISTENCE);

      // IMPORTANT: if there is an active Firebase session, we must sign out.
      // Otherwise onAuthStateChanged will immediately restore the user and "logout" will look broken.
      if (auth.currentUser) {
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
