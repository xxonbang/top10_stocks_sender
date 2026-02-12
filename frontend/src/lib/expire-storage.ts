/**
 * ExpireStorage - localStorage wrapper with session expiration
 *
 * Supabase createClient의 auth.storage 옵션으로 사용.
 * 저장되는 모든 항목에 만료 타임스탬프를 추가하여,
 * 절대 세션 시간 제한을 구현한다.
 *
 * admin 사용자는 만료를 우회하여 영구 로그인 유지.
 */

/** 절대 세션 유효 시간 (8시간) */
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

/** 내부 래핑 형식 식별용 키 */
const EXPIRE_MARKER = "__expire__"

/** admin 상태 저장용 localStorage 키 */
const ADMIN_FLAG_KEY = "__session_is_admin__"

interface WrappedItem {
  value: string
  [EXPIRE_MARKER]: number
}

function isWrappedItem(obj: unknown): obj is WrappedItem {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "value" in obj &&
    EXPIRE_MARKER in obj
  )
}

export const ExpireStorage = {
  /**
   * admin 상태를 설정한다.
   * admin이면 세션 만료를 우회한다.
   */
  setAdmin(isAdmin: boolean): void {
    if (isAdmin) {
      localStorage.setItem(ADMIN_FLAG_KEY, "1")
    } else {
      localStorage.removeItem(ADMIN_FLAG_KEY)
    }
  },

  /** 현재 admin 여부 확인 */
  isAdmin(): boolean {
    return localStorage.getItem(ADMIN_FLAG_KEY) === "1"
  },

  getItem(key: string): string | null {
    const raw = localStorage.getItem(key)
    if (raw === null) return null

    try {
      const parsed: unknown = JSON.parse(raw)

      if (isWrappedItem(parsed)) {
        // admin은 만료 무시
        if (this.isAdmin()) return parsed.value

        // 만료 확인
        if (Date.now() > parsed[EXPIRE_MARKER]) {
          localStorage.removeItem(key)
          return null
        }

        return parsed.value
      }
    } catch {
      // JSON 파싱 실패 → 일반 문자열로 취급
    }

    // 래핑되지 않은 기존 데이터는 그대로 반환
    return raw
  },

  setItem(key: string, value: string): void {
    const item: WrappedItem = {
      value,
      [EXPIRE_MARKER]: Date.now() + SESSION_DURATION_MS,
    }
    localStorage.setItem(key, JSON.stringify(item))
  },

  removeItem(key: string): void {
    localStorage.removeItem(key)
  },
}
