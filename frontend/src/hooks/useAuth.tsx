import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { ExpireStorage } from "@/lib/expire-storage"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  recordVisit: () => void
  logActivity: (actionType: string, actionDetail?: Record<string, string>) => void
}

const SYSTEM_NAME = "Theme_Analysis"

/** 비활성 자동 로그아웃 시간 (1시간) */
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000

/** 활동 감지 쓰로틀 간격 (30초) */
const ACTIVITY_THROTTLE_MS = 30 * 1000

const AuthContext = createContext<AuthContextType | null>(null)

function insertActivityLog(userId: string, email: string, actionType: string, actionDetail?: Record<string, string>) {
  supabase
    .from("user_activity_log")
    .insert({
      user_id: userId,
      email,
      system_name: SYSTEM_NAME,
      action_type: actionType,
      action_detail: actionDetail ?? {},
    })
    .then(({ error }) => {
      if (error) console.error("Failed to log activity:", error.message)
    })
}

function recordUserHistory(user: User) {
  supabase
    .from("user_history")
    .upsert(
      {
        user_id: user.id,
        email: user.email ?? "",
        system_name: SYSTEM_NAME,
        accessed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,system_name" },
    )
    .then(({ error }) => {
      if (error) console.error("Failed to record user history:", error.message)
    })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const isAdmin = user?.user_metadata?.role === "admin"

  // admin 상태를 ExpireStorage에 동기화
  useEffect(() => {
    ExpireStorage.setAdmin(isAdmin)
  }, [isAdmin])

  // 비활성 타이머 리셋
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    inactivityTimerRef.current = setTimeout(() => {
      console.log("[Session] 비활성 시간 초과 → 자동 로그아웃")
      supabase.auth.signOut()
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  // 비활성 타이머 관리 (admin 제외, 로그인 상태에서만)
  useEffect(() => {
    if (isAdmin || !user) {
      // admin이거나 로그인 안된 상태면 타이머 해제
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      return
    }

    const handleActivity = () => {
      const now = Date.now()
      // 쓰로틀: 30초마다 한 번만 타이머 리셋
      if (now - lastActivityRef.current > ACTIVITY_THROTTLE_MS) {
        lastActivityRef.current = now
        resetInactivityTimer()
      }
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart"]

    // 초기 타이머 시작
    resetInactivityTimer()

    events.forEach(event =>
      window.addEventListener(event, handleActivity, { passive: true }),
    )

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity))
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [isAdmin, user, resetInactivityTimer])

  // 탭 복귀 시 세션 유효성 확인
  useEffect(() => {
    if (!user || isAdmin) return

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // 탭 복귀 시 세션 재확인 (ExpireStorage가 만료 체크)
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            console.log("[Session] 탭 복귀 시 세션 만료 감지 → 로그아웃")
            setSession(null)
            setUser(null)
          }
        })
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [user, isAdmin])

  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) recordUserHistory(session.user)
      setLoading(false)
    })

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (event === "SIGNED_IN" && session?.user) {
        recordUserHistory(session.user)
        insertActivityLog(session.user.id, session.user.email ?? "", "login")
      }
      if (event === "SIGNED_OUT") {
        ExpireStorage.setAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async () => {
    if (user) {
      insertActivityLog(user.id, user.email ?? "", "logout")
    }
    await supabase.auth.signOut()
  }

  const recordVisit = useCallback(() => {
    if (user) recordUserHistory(user)
  }, [user])

  const logActivity = useCallback((actionType: string, actionDetail?: Record<string, string>) => {
    if (user) insertActivityLog(user.id, user.email ?? "", actionType, actionDetail)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signUp, signIn, signOut, recordVisit, logActivity }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
