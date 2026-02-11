import { useState } from "react"
import { Loader2, Mail, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { EyeChartLogo } from "@/components/EyeChartLogo"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type AuthTab = "login" | "signup"

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState<AuthTab>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (tab === "login") {
      const result = await signIn(email, password)
      if (result.error) setError(result.error)
    } else {
      const result = await signUp(email, password)
      if (result.error) {
        setError(result.error)
      } else {
        setSignUpSuccess(true)
      }
    }

    setLoading(false)
  }

  const switchTab = (newTab: AuthTab) => {
    setTab(newTab)
    setError(null)
    setSignUpSuccess(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo & Description */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
            <EyeChartLogo className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ThemeAnalyzer</h1>
          <p className="text-sm text-muted-foreground">오늘의 테마 분석</p>
        </div>

        {/* Tab Switcher (PaperTradingPage 스타일) */}
        <div className="flex rounded-lg bg-muted/50 p-1 gap-1">
          <button
            onClick={() => switchTab("login")}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-md text-xs sm:text-sm font-medium transition-all duration-150",
              tab === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            로그인
          </button>
          <button
            onClick={() => switchTab("signup")}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-md text-xs sm:text-sm font-medium transition-all duration-150",
              tab === "signup"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            회원가입
          </button>
        </div>

        {/* Sign Up Success Message */}
        {signUpSuccess && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm text-center">
            회원가입 완료! 이메일을 확인하여 계정을 인증해주세요.
          </div>
        )}

        {/* Form */}
        {!signUpSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                  autoComplete="email"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10"
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {tab === "login" ? "로그인" : "회원가입"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
