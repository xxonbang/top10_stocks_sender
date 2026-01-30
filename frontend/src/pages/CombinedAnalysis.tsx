import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLatestData, fetchKISData, fetchKISAnalysis } from '@/services/api';
import type { StockResult, KISStockData, KISAnalysisResult, MarketType, SignalType } from '@/services/types';
import { LoadingSpinner, EmptyState } from '@/components/common';
import { SignalBadge } from '@/components/signal';
import { MarketTabs } from '@/components/stock';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

// 일치 상태 타입
type MatchStatus = 'match' | 'partial' | 'mismatch' | 'vision-only' | 'api-only';

// 통합 종목 데이터
interface CombinedStock {
  code: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ' | 'UNKNOWN';
  visionSignal?: SignalType;
  visionReason?: string;
  apiSignal?: SignalType;
  apiReason?: string;
  apiData?: KISStockData;
  matchStatus: MatchStatus;
  confidenceScore: number;
}

// 시그널 레벨 (비교용)
const signalLevel: Record<SignalType, number> = {
  '적극매수': 2,
  '매수': 1,
  '중립': 0,
  '매도': -1,
  '적극매도': -2,
};

// 일치 상태 계산
function calculateMatchStatus(visionSignal?: SignalType, apiSignal?: SignalType): MatchStatus {
  if (!visionSignal && !apiSignal) return 'mismatch';
  if (!visionSignal) return 'api-only';
  if (!apiSignal) return 'vision-only';

  if (visionSignal === apiSignal) return 'match';

  const diff = Math.abs(signalLevel[visionSignal] - signalLevel[apiSignal]);
  if (diff <= 1) return 'partial';
  return 'mismatch';
}

// 신뢰도 점수 계산
function calculateConfidence(matchStatus: MatchStatus): number {
  switch (matchStatus) {
    case 'match': return 1.0;
    case 'partial': return 0.7;
    case 'vision-only':
    case 'api-only': return 0.5;
    case 'mismatch': return 0.3;
    default: return 0;
  }
}

// 일치 상태 뱃지
function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const config: Record<MatchStatus, { label: string; shortLabel: string; className: string; icon: string }> = {
    'match': { label: '완전 일치', shortLabel: '일치', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✓' },
    'partial': { label: '유사', shortLabel: '유사', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: '≈' },
    'mismatch': { label: '불일치', shortLabel: '불일치', className: 'bg-red-100 text-red-700 border-red-200', icon: '✗' },
    'vision-only': { label: 'Vision만', shortLabel: 'V', className: 'bg-purple-100 text-purple-700 border-purple-200', icon: '👁' },
    'api-only': { label: 'API만', shortLabel: 'A', className: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: '📡' },
  };

  const { label, shortLabel, className, icon } = config[status];

  return (
    <span className={cn('inline-flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 rounded text-[0.65rem] md:text-xs font-medium border', className)}>
      <span>{icon}</span>
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{shortLabel}</span>
    </span>
  );
}

// 신뢰도 바
function ConfidenceBar({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const colorClass = score >= 0.8 ? 'bg-emerald-500' : score >= 0.5 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      <div className="flex-1 h-1 md:h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-[0.65rem] md:text-xs font-medium text-text-muted w-7 md:w-8">{percentage}%</span>
    </div>
  );
}

// 통합 종목 카드
function CombinedStockCard({ stock }: { stock: CombinedStock }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const changeRate = stock.apiData?.price?.change_rate_pct ?? 0;
  const priceChangeColor = changeRate > 0 ? 'text-red-500' : changeRate < 0 ? 'text-blue-500' : 'text-text-secondary';

  return (
    <div className={cn(
      'bg-bg-secondary border rounded-xl p-3 md:p-4 transition-all',
      stock.matchStatus === 'match' ? 'border-emerald-300 bg-emerald-50/30' :
      stock.matchStatus === 'mismatch' ? 'border-red-300 bg-red-50/30' :
      'border-border hover:border-accent-primary'
    )}>
      {/* 헤더 */}
      <div className="flex justify-between items-start mb-2 md:mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
            <a
              href={`https://m.stock.naver.com/domestic/stock/${stock.code}/total`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-sm md:text-base text-text-primary hover:text-accent-primary transition-colors truncate"
            >
              {stock.name}
            </a>
            <span className={`text-[0.65rem] md:text-xs px-1 md:px-1.5 py-0.5 rounded flex-shrink-0 ${stock.market === 'KOSPI' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {stock.market}
            </span>
          </div>
          {stock.apiData?.price?.current != null && (
            <div className="flex items-baseline gap-1.5 md:gap-2">
              <span className="text-base md:text-lg font-bold">{stock.apiData.price.current.toLocaleString()}원</span>
              <span className={cn('text-xs md:text-sm font-medium', priceChangeColor)}>
                {(stock.apiData.price.change_rate_pct ?? 0) > 0 ? '+' : ''}{(stock.apiData.price.change_rate_pct ?? 0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <MatchStatusBadge status={stock.matchStatus} />
      </div>

      {/* 시그널 비교 */}
      <div className="grid grid-cols-2 gap-2 md:gap-3 mb-2 md:mb-3">
        <div className="bg-bg-primary rounded-lg p-2 md:p-3">
          <div className="text-[0.65rem] md:text-xs text-text-muted mb-1 md:mb-1.5 flex items-center gap-1">
            <span>👁</span> <span className="hidden md:inline">Vision AI</span><span className="md:hidden">Vision</span>
          </div>
          {stock.visionSignal ? (
            <SignalBadge signal={stock.visionSignal} />
          ) : (
            <span className="text-[0.65rem] md:text-xs text-text-muted">없음</span>
          )}
        </div>
        <div className="bg-bg-primary rounded-lg p-2 md:p-3">
          <div className="text-[0.65rem] md:text-xs text-text-muted mb-1 md:mb-1.5 flex items-center gap-1">
            <span>📡</span> <span className="hidden md:inline">한투 API</span><span className="md:hidden">API</span>
          </div>
          {stock.apiSignal ? (
            <SignalBadge signal={stock.apiSignal} />
          ) : (
            <span className="text-[0.65rem] md:text-xs text-text-muted">없음</span>
          )}
        </div>
      </div>

      {/* 신뢰도 */}
      <div className="mb-2 md:mb-3">
        <div className="text-[0.65rem] md:text-xs text-text-muted mb-1">신뢰도</div>
        <ConfidenceBar score={stock.confidenceScore} />
      </div>

      {/* 분석 근거 토글 */}
      {(stock.visionReason || stock.apiReason) && (
        <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center justify-between text-[0.65rem] md:text-xs text-text-muted mb-1">
            <span>분석 근거</span>
            <span className="transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </div>
          <div className={cn('overflow-hidden transition-all duration-300 ease-in-out', isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0')}>
            <div className="space-y-1.5 md:space-y-2">
              {stock.visionReason && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 md:p-3">
                  <div className="text-[0.65rem] md:text-xs font-medium text-purple-700 mb-1">👁 Vision</div>
                  <p className="text-xs md:text-sm text-text-secondary">{stock.visionReason}</p>
                </div>
              )}
              {stock.apiReason && (
                <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-2 md:p-3">
                  <div className="text-[0.65rem] md:text-xs font-medium text-cyan-700 mb-1">📡 API</div>
                  <p className="text-xs md:text-sm text-text-secondary">{stock.apiReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 통계 요약 카드
function StatCard({ icon, label, value, subValue, colorClass }: {
  icon: string;
  label: string;
  value: string | number;
  subValue?: string;
  colorClass?: string;
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-xl px-2 py-2 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 shadow-sm">
      <div className={cn('w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-base md:text-xl flex-shrink-0', colorClass || 'bg-gray-100')}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[0.55rem] md:text-[0.65rem] text-text-muted uppercase tracking-wide font-semibold truncate">
          {label}
        </div>
        <div className="text-sm md:text-base font-bold text-text-primary">
          {value}
          {subValue && <span className="text-[0.65rem] md:text-sm text-text-muted font-medium ml-0.5 md:ml-1">({subValue})</span>}
        </div>
      </div>
    </div>
  );
}

// 팁 텍스트
function TipText({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.8125rem] text-text-secondary flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg leading-relaxed mb-4">
      <svg className="w-4 h-4 flex-shrink-0 text-slate-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
      </svg>
      <span className="flex-1">{children}</span>
    </div>
  );
}

export function CombinedAnalysis() {
  const { activeTab } = useUIStore();
  const [marketFilter, setMarketFilter] = useState<MarketType>('all');
  const [matchFilter, setMatchFilter] = useState<MatchStatus | 'all'>('all');

  // 탭 변경 시 필터 초기화
  useEffect(() => {
    setMatchFilter('all');
  }, [activeTab]);

  // Vision AI 데이터 로드
  const { data: visionData, isLoading: isLoadingVision } = useQuery({
    queryKey: ['vision', 'latest'],
    queryFn: fetchLatestData,
  });

  // KIS 데이터 로드
  const { data: kisData, isLoading: isLoadingKIS } = useQuery({
    queryKey: ['kis-data'],
    queryFn: fetchKISData,
  });

  // KIS 분석 결과 로드
  const { data: kisAnalysis, isLoading: isLoadingAnalysis } = useQuery({
    queryKey: ['kis-analysis'],
    queryFn: fetchKISAnalysis,
  });

  // 통합 데이터 생성
  const combinedStocks = useMemo((): CombinedStock[] => {
    const stockMap = new Map<string, CombinedStock>();

    // Vision AI 데이터 추가
    if (visionData?.results) {
      visionData.results.forEach((stock: StockResult) => {
        const market = stock.code.startsWith('3') || stock.code.startsWith('4') ? 'KOSDAQ' : 'KOSPI';
        stockMap.set(stock.code, {
          code: stock.code,
          name: stock.name,
          market: market as 'KOSPI' | 'KOSDAQ',
          visionSignal: stock.signal,
          visionReason: stock.reason,
          matchStatus: 'vision-only',
          confidenceScore: 0.5,
        });
      });
    }

    // KIS 데이터 및 분석 결과 추가
    if (kisData?.stocks) {
      const analysisMap = new Map<string, KISAnalysisResult>();
      if (kisAnalysis?.results) {
        kisAnalysis.results.forEach(r => analysisMap.set(r.code, r));
      }

      Object.values(kisData.stocks).forEach((stock: KISStockData) => {
        const analysis = analysisMap.get(stock.code);
        const existing = stockMap.get(stock.code);

        if (existing) {
          // 기존 Vision 데이터에 API 데이터 병합
          existing.apiData = stock;
          existing.apiSignal = analysis?.signal;
          existing.apiReason = analysis?.reason;
          existing.matchStatus = calculateMatchStatus(existing.visionSignal, existing.apiSignal);
          existing.confidenceScore = calculateConfidence(existing.matchStatus);
        } else {
          // 새로운 API 전용 데이터
          stockMap.set(stock.code, {
            code: stock.code,
            name: stock.name,
            market: stock.market,
            apiData: stock,
            apiSignal: analysis?.signal,
            apiReason: analysis?.reason,
            matchStatus: analysis?.signal ? 'api-only' : 'api-only',
            confidenceScore: analysis?.signal ? 0.5 : 0,
          });
        }
      });
    }

    return Array.from(stockMap.values());
  }, [visionData, kisData, kisAnalysis]);

  // 필터링
  const filteredStocks = useMemo(() => {
    let stocks = combinedStocks;

    // 시장 필터
    if (marketFilter !== 'all') {
      stocks = stocks.filter(s => s.market.toLowerCase() === marketFilter);
    }

    // 일치 상태 필터
    if (matchFilter !== 'all') {
      stocks = stocks.filter(s => s.matchStatus === matchFilter);
    }

    // 신뢰도 순으로 정렬 (높은 순)
    return stocks.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }, [combinedStocks, marketFilter, matchFilter]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = combinedStocks.length;
    const matched = combinedStocks.filter(s => s.matchStatus === 'match').length;
    const partial = combinedStocks.filter(s => s.matchStatus === 'partial').length;
    const mismatched = combinedStocks.filter(s => s.matchStatus === 'mismatch').length;
    const visionOnly = combinedStocks.filter(s => s.matchStatus === 'vision-only').length;
    const apiOnly = combinedStocks.filter(s => s.matchStatus === 'api-only').length;
    const avgConfidence = combinedStocks.length > 0
      ? combinedStocks.reduce((sum, s) => sum + s.confidenceScore, 0) / combinedStocks.length
      : 0;

    return { total, matched, partial, mismatched, visionOnly, apiOnly, avgConfidence };
  }, [combinedStocks]);

  // 시장별 카운트
  const marketCounts = useMemo(() => ({
    all: filteredStocks.length,
    kospi: combinedStocks.filter(s => s.market === 'KOSPI').length,
    kosdaq: combinedStocks.filter(s => s.market === 'KOSDAQ').length,
  }), [combinedStocks, filteredStocks]);

  const isLoading = isLoadingVision || isLoadingKIS || isLoadingAnalysis;

  if (isLoading) {
    return (
      <section id="combined-analysis" className="mb-10">
        <LoadingSpinner message="데이터 통합 중..." />
      </section>
    );
  }

  const hasVisionData = visionData && visionData.results && visionData.results.length > 0;
  const hasKISData = kisData?.stocks && Object.keys(kisData.stocks).length > 0;

  if (!hasVisionData && !hasKISData) {
    return (
      <section id="combined-analysis" className="mb-10">
        <EmptyState
          icon="📊"
          title="분석 데이터가 없습니다"
          description="Vision AI 분석 또는 한투 API 데이터가 수집되면 여기에 비교 결과가 표시됩니다."
        />
      </section>
    );
  }

  return (
    <section id="combined-analysis" className="mb-10">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-text-primary mb-1">분석 종합</h2>
          <p className="text-sm text-text-muted">Vision AI와 한투 API 분석 결과 비교 검증</p>
        </div>
      </div>

      {/* KIS 데이터 없음 안내 */}
      {hasVisionData && !hasKISData && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg mb-5 text-sm text-amber-800">
          <span>📡</span>
          <span>한투 API 데이터가 아직 수집되지 않았습니다. 현재는 Vision AI 분석 결과만 표시됩니다.</span>
        </div>
      )}

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard icon="📊" label="총 종목" value={stats.total} colorClass="bg-gray-100" />
        <StatCard icon="✓" label="완전 일치" value={stats.matched} subValue={`${((stats.matched / stats.total) * 100).toFixed(0)}%`} colorClass="bg-emerald-100" />
        <StatCard icon="≈" label="유사" value={stats.partial} colorClass="bg-blue-100" />
        <StatCard icon="✗" label="불일치" value={stats.mismatched} colorClass="bg-red-100" />
      </div>

      {/* 평균 신뢰도 */}
      <div className="bg-bg-secondary border border-border rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">평균 신뢰도</span>
          <span className="text-lg font-bold">{(stats.avgConfidence * 100).toFixed(0)}%</span>
        </div>
        <ConfidenceBar score={stats.avgConfidence} />
        <p className="text-xs text-text-muted mt-2">
          두 분석 소스의 일치율이 높을수록 신뢰도가 높습니다. 완전 일치=100%, 유사=70%, 단일 소스=50%, 불일치=30%
        </p>
      </div>

      <TipText>
        "완전 일치" 종목은 Vision AI와 API 분석 시그널이 동일합니다. "불일치" 종목은 추가 검토가 필요합니다.
      </TipText>

      {/* 일치 상태 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { value: 'all' as const, label: '전체', count: combinedStocks.length },
          { value: 'match' as const, label: '완전 일치', count: stats.matched },
          { value: 'partial' as const, label: '유사', count: stats.partial },
          { value: 'mismatch' as const, label: '불일치', count: stats.mismatched },
          { value: 'vision-only' as const, label: 'Vision만', count: stats.visionOnly },
          { value: 'api-only' as const, label: 'API만', count: stats.apiOnly },
        ].map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => setMatchFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              matchFilter === value
                ? 'bg-accent-primary text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
            )}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* 시장 탭 */}
      <MarketTabs
        active={marketFilter}
        counts={marketCounts}
        onChange={setMarketFilter}
      />

      {/* 종목 그리드 */}
      {filteredStocks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStocks.map(stock => (
            <CombinedStockCard key={stock.code} stock={stock} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🔍"
          title="검색 결과가 없습니다"
          description="선택한 필터 조건에 맞는 종목이 없습니다."
        />
      )}
    </section>
  );
}
