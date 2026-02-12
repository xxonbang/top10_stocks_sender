# Supabase 세션 관리 가이드 (Free Plan)

Supabase Free Plan에서 프론트엔드 기반으로 세션 만료 + 비활성 자동 로그아웃을 구현하는 방법.

## 배경

Supabase Free Plan에서는 대시보드에서 Refresh Token 유효기간이나 세션 비활성 타임아웃을 설정할 수 없다 (Pro Plan 이상 필요). 따라서 프론트엔드에서 직접 구현해야 한다.

## 구현 방식: ExpireStorage + Inactivity Timer

두 가지 메커니즘을 조합한다:

| 메커니즘 | 역할 | 동작 |
|---------|------|------|
| **ExpireStorage** | 절대 세션 시간 제한 | localStorage에 만료 타임스탬프 저장, 만료 시 세션 데이터 삭제 |
| **Inactivity Timer** | 비활성 자동 로그아웃 | 사용자 활동 감지, 일정 시간 무활동 시 signOut() 호출 |

### 왜 두 가지 모두 필요한가?

- **ExpireStorage만** 사용: 사용자가 탭을 열어두고 방치해도, Supabase가 토큰을 자동 갱신하므로 절대 시간 제한으로만 만료됨. 비활성 상태에서도 오래 유지될 수 있음.
- **Inactivity Timer만** 사용: 브라우저가 백그라운드에서 setTimeout을 지연/중단할 수 있어, 탭을 닫았다가 다시 열면 타이머가 작동하지 않을 수 있음.
- **두 가지 조합**: 절대 시간 제한(ExpireStorage)이 storage 레벨에서 세션 데이터를 만료시키고, 비활성 타이머가 활성 탭에서의 유휴 상태를 감지하여 자동 로그아웃. 탭 복귀 시 visibilitychange 이벤트로 만료 여부 재확인.

---

## 1단계: ExpireStorage 구현

Supabase `createClient`의 `auth.storage` 옵션에 커스텀 storage 객체를 전달한다. 이 객체는 `getItem`, `setItem`, `removeItem` 메서드를 구현하며, localStorage를 래핑하여 각 항목에 만료 타임스탬프를 추가한다.

### 코드

```typescript
// lib/expire-storage.ts

/** 절대 세션 유효 시간 (예: 8시간) */
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

/** 내부 래핑 형식 식별용 키 */
const EXPIRE_MARKER = "__expire__"

/** 특정 역할(admin 등) 만료 면제 플래그 키 */
const ADMIN_FLAG_KEY = "__session_is_admin__"

interface WrappedItem {
  value: string
  [key: string]: unknown  // EXPIRE_MARKER 필드용
}

function isWrappedItem(obj: unknown): obj is WrappedItem {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "value" in obj &&
    EXPIRE_MARKER in (obj as Record<string, unknown>)
  )
}

export const ExpireStorage = {
  /**
   * 만료 면제 여부를 설정한다.
   * 예: admin 사용자는 세션 만료를 우회.
   */
  setAdmin(isAdmin: boolean): void {
    if (isAdmin) {
      localStorage.setItem(ADMIN_FLAG_KEY, "1")
    } else {
      localStorage.removeItem(ADMIN_FLAG_KEY)
    }
  },

  /** 만료 면제 여부 확인 */
  isAdmin(): boolean {
    return localStorage.getItem(ADMIN_FLAG_KEY) === "1"
  },

  getItem(key: string): string | null {
    const raw = localStorage.getItem(key)
    if (raw === null) return null

    try {
      const parsed: unknown = JSON.parse(raw)

      if (isWrappedItem(parsed)) {
        // 면제 사용자는 만료 무시
        if (this.isAdmin()) return parsed.value

        // 만료 확인
        if (Date.now() > (parsed as Record<string, number>)[EXPIRE_MARKER]) {
          localStorage.removeItem(key)
          return null  // → Supabase가 세션 없음으로 인식
        }

        return parsed.value
      }
    } catch {
      // JSON 파싱 실패 → 일반 문자열
    }

    return raw
  },

  setItem(key: string, value: string): void {
    const item = {
      value,
      [EXPIRE_MARKER]: Date.now() + SESSION_DURATION_MS,
    }
    localStorage.setItem(key, JSON.stringify(item))
  },

  removeItem(key: string): void {
    localStorage.removeItem(key)
  },
}
```

### 동작 원리

1. Supabase가 세션 토큰을 저장할 때 `setItem`이 호출됨
2. 실제 값과 함께 만료 타임스탬프(`__expire__`)가 저장됨
3. Supabase가 세션을 읽을 때 `getItem`이 호출됨
4. 만료 시간이 지났으면 `null` 반환 → Supabase가 "세션 없음"으로 인식 → 로그아웃 상태

---

## 2단계: Supabase Client에 ExpireStorage 적용

```typescript
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js"
import { ExpireStorage } from "./expire-storage"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpireStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
})
```

---

## 3단계: Inactivity Timer 구현

Auth Provider(또는 최상위 컴포넌트)에서 사용자 활동을 감지하고, 일정 시간 무활동 시 자동 로그아웃한다.

### 핵심 구현 요소

```typescript
// Auth Provider 내부

/** 비활성 자동 로그아웃 시간 */
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000  // 1시간

/** 활동 감지 쓰로틀 간격 (이벤트 과다 방지) */
const ACTIVITY_THROTTLE_MS = 30 * 1000  // 30초

// 타이머 ref
const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const lastActivityRef = useRef<number>(Date.now())

// 타이머 리셋 함수
const resetInactivityTimer = useCallback(() => {
  if (inactivityTimerRef.current) {
    clearTimeout(inactivityTimerRef.current)
  }
  inactivityTimerRef.current = setTimeout(() => {
    supabase.auth.signOut()
  }, INACTIVITY_TIMEOUT_MS)
}, [])

// 활동 감지 + 타이머 관리
useEffect(() => {
  // 면제 사용자(admin)이거나 비로그인 상태면 타이머 불필요
  if (isExempt || !user) {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    return
  }

  const handleActivity = () => {
    const now = Date.now()
    // 쓰로틀: 30초마다 한 번만 리셋 (성능 보호)
    if (now - lastActivityRef.current > ACTIVITY_THROTTLE_MS) {
      lastActivityRef.current = now
      resetInactivityTimer()
    }
  }

  const events = ["mousedown", "keydown", "scroll", "touchstart"]

  resetInactivityTimer()  // 초기 타이머 시작

  events.forEach(event =>
    window.addEventListener(event, handleActivity, { passive: true })
  )

  return () => {
    events.forEach(event => window.removeEventListener(event, handleActivity))
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }
}, [isExempt, user, resetInactivityTimer])
```

### 탭 복귀 시 세션 확인

브라우저가 백그라운드에서 setTimeout을 지연시킬 수 있으므로, 탭 복귀 시 세션 유효성을 재확인한다:

```typescript
useEffect(() => {
  if (!user || isExempt) return

  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          // ExpireStorage에서 만료 감지됨 → UI 상태 초기화
          setSession(null)
          setUser(null)
        }
      })
    }
  }

  document.addEventListener("visibilitychange", handleVisibility)
  return () => document.removeEventListener("visibilitychange", handleVisibility)
}, [user, isExempt])
```

---

## 4단계: Admin 면제 (역할 기반 면제)

특정 사용자 역할(예: admin)은 세션 만료와 비활성 타이머를 모두 면제한다.

### 면제 판단 기준

```typescript
// Supabase user_metadata에서 역할 확인
const isAdmin = user?.user_metadata?.role === "admin"
```

### 면제 동기화

```typescript
// admin 상태가 변경될 때 ExpireStorage에 동기화
useEffect(() => {
  ExpireStorage.setAdmin(isAdmin)
}, [isAdmin])

// 로그아웃 시 면제 해제
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    ExpireStorage.setAdmin(false)
  }
})
```

### 동작 흐름

| 사용자 | ExpireStorage | Inactivity Timer | 결과 |
|--------|--------------|-----------------|------|
| 일반 사용자 | 8시간 후 만료 | 1시간 무활동 시 로그아웃 | 최대 8시간, 비활성 1시간 |
| admin | 만료 우회 | 타이머 미적용 | 영구 로그인 유지 |

---

## Supabase에서 admin 역할 설정 방법

Supabase Dashboard → Authentication → Users → 사용자 선택 → Edit User Metadata:

```json
{
  "role": "admin"
}
```

또는 SQL:

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'admin@example.com';
```

---

## 5단계: 사용자 활동 로그 (Activity Logging)

세션 관리와 함께, 사용자의 상세 활동 이력을 Supabase에 기록한다.

### 테이블 생성

```sql
CREATE TABLE user_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL DEFAULT '',
  system_name text NOT NULL,
  action_type text NOT NULL,
  action_detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 조회 성능을 위한 인덱스
CREATE INDEX idx_activity_log_user_system ON user_activity_log(user_id, system_name);
CREATE INDEX idx_activity_log_created_at ON user_activity_log(created_at DESC);

-- RLS 활성화
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자가 자기 이력만 INSERT 가능
CREATE POLICY "Users can insert own activity"
  ON user_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### 추적 이벤트 종류

| action_type | action_detail 예시 | 설명 |
|------------|-------------------|------|
| `login` | `{}` | 사용자 로그인 |
| `logout` | `{}` | 사용자 로그아웃 |
| `page_view` | `{"page": "home"}` | 페이지 접속/전환 |
| `tab_switch` | `{"tab": "volume"}` | 데이터 탭 전환 |
| `mode_change` | `{"fluctuation_mode": "direct"}` | 보기 모드 변경 |
| `history_view` | `{"date": "2026-02-10"}` | 과거 데이터 조회 |
| `data_refresh` | `{}` | 수동 데이터 새로고침 |

### 구현 패턴

#### 1) 공통 로깅 함수

Auth Provider 외부에 Supabase INSERT를 직접 호출하는 헬퍼 함수를 정의한다:

```typescript
function insertActivityLog(
  userId: string,
  email: string,
  actionType: string,
  actionDetail?: Record<string, string>,
) {
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
```

#### 2) Context에 logActivity 노출

Auth Provider 내부에서 현재 사용자 기반으로 간편 호출 가능한 함수를 만들어 context에 추가한다:

```typescript
const logActivity = useCallback(
  (actionType: string, actionDetail?: Record<string, string>) => {
    if (user) insertActivityLog(user.id, user.email ?? "", actionType, actionDetail)
  },
  [user],
)
```

#### 3) 로그인/로그아웃 추적

로그인은 `onAuthStateChange`에서, 로그아웃은 `signOut` 함수에서 직접 호출한다:

```typescript
// 로그인 (onAuthStateChange 콜백 내)
if (event === "SIGNED_IN" && session?.user) {
  insertActivityLog(session.user.id, session.user.email ?? "", "login")
}

// 로그아웃 (signOut 함수 내)
const signOut = async () => {
  if (user) {
    insertActivityLog(user.id, user.email ?? "", "logout")
  }
  await supabase.auth.signOut()
}
```

#### 4) 페이지/탭 전환 추적

페이지 전환은 useEffect로, 탭 전환은 핸들러 래핑으로 추적한다:

```typescript
// 페이지 전환 — useEffect (마운트 + 변경 시 모두 기록)
useEffect(() => {
  logActivity("page_view", { page: currentPage })
}, [currentPage, logActivity])

// 탭 전환 — 핸들러 래핑 (사용자 조작 시에만 기록)
const handleTabChange = useCallback((tab: string) => {
  setActiveTab(tab)
  logActivity("tab_switch", { tab })
}, [logActivity])
```

#### 5) 기타 이벤트 추적

기능 사용 시점에 `logActivity`를 호출한다:

```typescript
// 과거 데이터 조회
const handleHistorySelect = async (entry: HistoryEntry) => {
  await fetchHistoryData(entry)
  logActivity("history_view", { date: entry.date })
}

// 수동 새로고침
const handleRefresh = useCallback(() => {
  refreshFromAPI()
  logActivity("data_refresh")
}, [refreshFromAPI, logActivity])
```

### 데이터 활용

Supabase Dashboard → Table Editor 또는 SQL Editor에서 조회:

```sql
-- 최근 활동 100건
SELECT * FROM user_activity_log ORDER BY created_at DESC LIMIT 100;

-- 사용자별 활동 요약
SELECT email, action_type, COUNT(*), MAX(created_at) as last_at
FROM user_activity_log
GROUP BY email, action_type
ORDER BY email, COUNT(*) DESC;

-- 일별 활성 사용자 수
SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as dau
FROM user_activity_log
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 데이터 정리 (선택)

로그가 누적되면 오래된 데이터를 정리한다:

```sql
-- 90일 이전 로그 삭제
DELETE FROM user_activity_log WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 설정값 커스터마이징

| 상수 | 기본값 | 설명 |
|------|-------|------|
| `SESSION_DURATION_MS` | 8시간 | 절대 세션 유효 시간. 로그인 후 이 시간이 지나면 세션 만료. |
| `INACTIVITY_TIMEOUT_MS` | 1시간 | 비활성 자동 로그아웃 시간. 사용자 활동 없이 이 시간 경과 시 로그아웃. |
| `ACTIVITY_THROTTLE_MS` | 30초 | 활동 감지 쓰로틀. 이벤트 핸들러 과다 호출 방지. |
| `ADMIN_FLAG_KEY` | `__session_is_admin__` | 면제 플래그 localStorage 키. |

---

## 체크리스트

- [ ] `expire-storage.ts` 파일 생성
- [ ] Supabase `createClient`에 `auth.storage: ExpireStorage` 설정
- [ ] Auth Provider에 비활성 타이머 추가
- [ ] 탭 복귀 시 `visibilitychange` 핸들러 추가
- [ ] admin 면제 로직 추가 (`ExpireStorage.setAdmin` + 타이머 스킵)
- [ ] 로그아웃 시 `ExpireStorage.setAdmin(false)` 호출
- [ ] 빌드 및 동작 확인

### 활동 로그

- [ ] `user_activity_log` 테이블 생성 (SQL 실행)
- [ ] RLS 정책 설정 (INSERT only, auth.uid() = user_id)
- [ ] `insertActivityLog` 헬퍼 함수 구현
- [ ] Auth Context에 `logActivity` 노출
- [ ] 로그인/로그아웃 이벤트 추적
- [ ] 페이지 전환 (`page_view`) 추적
- [ ] 탭 전환 (`tab_switch`) 추적
- [ ] 모드 변경 (`mode_change`) 추적
- [ ] 기타 이벤트 (history_view, data_refresh) 추적
