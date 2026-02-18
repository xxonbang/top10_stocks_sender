const CRITERIA_LEGEND = [
  { color: "bg-red-500", label: "전고점 돌파" },
  { color: "bg-orange-500", label: "끼 보유" },
  { color: "bg-yellow-400", label: "저항선 돌파" },
  { color: "bg-green-500", label: "정배열" },
  { color: "bg-blue-500", label: "외국인/기관 수급" },
  { color: "bg-lime-400", label: "프로그램 매매" },
  { color: "bg-pink-500", label: "거래대금 TOP30" },
] as const

export function CriteriaLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-muted/40 rounded-lg text-[10px] sm:text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">선정 기준:</span>
      {CRITERIA_LEGEND.map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${color}`} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ring-1 ring-yellow-400 bg-yellow-400/30" />
        전체 충족
      </span>
    </div>
  )
}
