import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { KosdaqIndex } from "@/types/stock"

interface KosdaqIndexAlertProps {
  data: KosdaqIndex
}

export function KosdaqIndexAlert({ data }: KosdaqIndexAlertProps) {
  const [showDetail, setShowDetail] = useState(false)

  const statusConfig = {
    "정배열": {
      bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
      icon: "📈",
      badge: "bg-emerald-100 text-emerald-800",
    },
    "역배열": {
      bg: "bg-red-50 border-red-200 text-red-700",
      icon: "📉",
      badge: "bg-red-100 text-red-800",
    },
    "혼합": {
      bg: "bg-muted border-border text-muted-foreground",
      icon: "📊",
      badge: "bg-muted text-muted-foreground",
    },
  }

  const config = statusConfig[data.status]
  const maValues = [
    { label: "MA5", value: data.ma5 },
    { label: "MA10", value: data.ma10 },
    { label: "MA20", value: data.ma20 },
    { label: "MA60", value: data.ma60 },
    { label: "MA120", value: data.ma120 },
  ]

  return (
    <button
      onClick={() => setShowDetail(!showDetail)}
      className={cn(
        "mb-4 sm:mb-6 w-full text-left border rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-200",
        config.bg
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm sm:text-base">{config.icon}</span>
          <span className="font-medium text-xs sm:text-sm truncate">
            코스닥 지수 이동평균선
          </span>
          <span className={cn("text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-semibold", config.badge)}>
            {data.status}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs sm:text-sm font-bold tabular-nums">
            {data.current.toFixed(2)}
          </span>
          {showDetail ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
        </div>
      </div>

      {showDetail && (
        <div className="mt-2 pt-2 border-t border-current/10 flex flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-xs tabular-nums">
          <span className="font-medium">현재 {data.current.toFixed(2)}</span>
          {maValues.filter(({ value }) => value > 0).map(({ label, value }) => (
            <span key={label} className="opacity-80">
              {label} {value.toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
