import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchKISData, fetchKISAnalysis } from '@/services/api';
import type { KISStockData, KISAnalysisResult, MarketType, SignalType, SignalCounts } from '@/services/types';
import { LoadingSpinner, EmptyState, Button } from '@/components/common';
import { SignalSummary, SignalBadge } from '@/components/signal';
import { MarketTabs } from '@/components/stock';
import { useUIStore } from '@/store/uiStore';

// 숫자 포맷
function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

function formatPercent(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

// 투자자 동향 뱃지
function FlowBadge({ value, label }: { value: number | null | undefined; label: string }) {
  if (value === null || value === undefined) return null;
  const isPositive = value > 0;
  const bgColor = isPositive ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
  // 모바일에서는 숫자를 간략화
  const displayValue = Math.abs(value) >= 10000
    ? `${(value / 10000).toFixed(0)}만`
    : formatNumber(value);
  return (
    <span className={`inline-flex items-center px-1.5 md:px-2 py-0.5 rounded text-[0.65rem] md:text-xs font-medium ${bgColor}`}>
      {label}: {isPositive ? '+' : ''}{displayValue}
    </span>
  );
}

// 팁 텍스트 컴포넌트
function TipText({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.7rem] md:text-[0.8125rem] text-text-secondary flex items-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 bg-slate-50 border border-slate-200 rounded-lg leading-relaxed mb-3 md:mb-4">
      <svg className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 text-slate-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
      </svg>
      <span className="flex-1">{children}</span>
    </div>
  );
}

// 필터 인디케이터
function FilterIndicator({ signal, onClear }: { signal: SignalType | null; onClear: () => void }) {
  if (!signal) return null;

  return (
    <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-bg-accent border border-accent-primary rounded-lg mb-3 md:mb-4 text-xs md:text-sm text-accent-primary">
      <span className="flex-1 font-medium">
        "{signal}" 필터 적용 중
      </span>
      <Button variant="primary" size="sm" onClick={onClear}>
        해제
      </Button>
    </div>
  );
}

// 개별 종목 카드
function StockCard({
  stock,
  analysis,
  isExpanded,
  onToggle
}: {
  stock: KISStockData;
  analysis?: KISAnalysisResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const changeRate = stock.price?.change_rate_pct ?? 0;
  const priceChangeColor = changeRate > 0 ? 'text-red-500' : changeRate < 0 ? 'text-blue-500' : 'text-text-secondary';

  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-3 md:p-4 hover:border-accent-primary transition-all">
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
          <div className="flex items-baseline gap-1.5 md:gap-2">
            <span className="text-base md:text-lg font-bold">{formatNumber(stock.price?.current)}원</span>
            <span className={`text-xs md:text-sm font-medium ${priceChangeColor}`}>
              {formatPercent(stock.price?.change_rate_pct)}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          {analysis && (
            <SignalBadge signal={analysis.signal} />
          )}
          <div className="text-[0.65rem] md:text-xs text-text-muted mt-1">
            #{stock.ranking?.volume_rank ?? '-'}위
          </div>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-4 gap-1 md:gap-2 mb-2 md:mb-3 text-[0.65rem] md:text-xs">
        <div className="bg-bg-primary rounded-lg p-1.5 md:p-2 text-center">
          <div className="text-text-muted mb-0.5">PER</div>
          <div className="font-medium">{stock.valuation?.per && stock.valuation.per > 0 ? stock.valuation.per.toFixed(1) : '-'}</div>
        </div>
        <div className="bg-bg-primary rounded-lg p-1.5 md:p-2 text-center">
          <div className="text-text-muted mb-0.5">PBR</div>
          <div className="font-medium">{stock.valuation?.pbr && stock.valuation.pbr > 0 ? stock.valuation.pbr.toFixed(2) : '-'}</div>
        </div>
        <div className="bg-bg-primary rounded-lg p-1.5 md:p-2 text-center">
          <div className="text-text-muted mb-0.5 truncate">거래량</div>
          <div className="font-medium text-amber-600">+{stock.ranking?.volume_rate_vs_prev?.toFixed(0) ?? '-'}%</div>
        </div>
        <div className="bg-bg-primary rounded-lg p-1.5 md:p-2 text-center">
          <div className="text-text-muted mb-0.5 truncate">52주</div>
          <div className="font-medium">
            {stock.price?.high_52week ? ((stock.price.current / stock.price.high_52week) * 100).toFixed(0) : '-'}%
          </div>
        </div>
      </div>

      {/* 투자자 동향 */}
      <div className="flex flex-wrap gap-1 mb-2 md:mb-3">
        <FlowBadge value={stock.investor_flow?.today?.foreign_net} label="외인" />
        <FlowBadge value={stock.investor_flow?.today?.institution_net} label="기관" />
        <FlowBadge value={stock.investor_flow?.today?.individual_net} label="개인" />
      </div>

      {/* 분석 근거 (있는 경우) */}
      {analysis && (
        <div
          className="cursor-pointer"
          onClick={onToggle}
        >
          <div className="flex items-center justify-between text-[0.65rem] md:text-xs text-text-muted mb-1">
            <span>AI 분석 근거</span>
            <span className="transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </div>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div className="bg-bg-primary rounded-lg p-2 md:p-3 text-xs md:text-sm">
              <p className="text-text-secondary mb-2">{analysis.reason}</p>
              {analysis.key_factors && (
                <div className="grid grid-cols-2 gap-1.5 md:gap-2 text-[0.65rem] md:text-xs">
                  <div><span className="text-text-muted">추세:</span> {analysis.key_factors.price_trend}</div>
                  <div><span className="text-text-muted">거래량:</span> {analysis.key_factors.volume_signal}</div>
                  <div><span className="text-text-muted">외인:</span> {analysis.key_factors.foreign_flow}</div>
                  <div><span className="text-text-muted">밸류:</span> {analysis.key_factors.valuation}</div>
                </div>
              )}
              {analysis.confidence != null && (
                <div className="mt-2 text-[0.65rem] md:text-xs text-text-muted">
                  신뢰도: {((analysis.confidence ?? 0) * 100).toFixed(0)}% | 위험도: {analysis.risk_level || '-'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 결과 메타 정보
function ResultsMeta({ collectedAt, totalStocks, analyzedCount }: {
  collectedAt: string;
  totalStocks: number;
  analyzedCount: number;
}) {
  const formattedDate = collectedAt?.replace('T', ' ').slice(0, 16) || '-';
  const timeOnly = formattedDate.split(' ')[1] || '';

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3 mb-5">
      <div className="bg-bg-secondary border border-border rounded-xl px-3 py-2.5 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 shadow-sm">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-100 flex items-center justify-center text-base md:text-xl flex-shrink-0">
          📅
        </div>
        <div className="min-w-0">
          <div className="text-[0.6rem] md:text-[0.65rem] text-text-muted uppercase tracking-wide font-semibold">
            수집 시각
          </div>
          <div className="text-xs md:text-base font-bold text-text-primary truncate">
            <span className="hidden md:inline">{formattedDate}</span>
            <span className="md:hidden">{timeOnly}</span>
          </div>
        </div>
      </div>
      <div className="bg-bg-secondary border border-border rounded-xl px-3 py-2.5 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 shadow-sm">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-base md:text-xl flex-shrink-0">
          📊
        </div>
        <div className="min-w-0">
          <div className="text-[0.6rem] md:text-[0.65rem] text-text-muted uppercase tracking-wide font-semibold">
            수집 종목
          </div>
          <div className="text-xs md:text-base font-bold text-text-primary">{totalStocks}개</div>
        </div>
      </div>
      <div className="bg-bg-secondary border border-border rounded-xl px-3 py-2.5 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 shadow-sm">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-purple-100 flex items-center justify-center text-base md:text-xl flex-shrink-0">
          🤖
        </div>
        <div className="min-w-0">
          <div className="text-[0.6rem] md:text-[0.65rem] text-text-muted uppercase tracking-wide font-semibold">
            AI 분석
          </div>
          <div className="text-xs md:text-base font-bold text-text-primary">{analyzedCount}개</div>
        </div>
      </div>
    </div>
  );
}

export function APIAnalysis() {
  const { activeTab } = useUIStore();
  const [marketFilter, setMarketFilter] = useState<MarketType>('all');
  const [signalFilter, setSignalFilter] = useState<SignalType | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // 탭 변경 시 확장된 카드 초기화
  useEffect(() => {
    setExpandedCards(new Set());
  }, [activeTab]);

  // 필터 변경 시 확장된 카드 초기화
  useEffect(() => {
    setExpandedCards(new Set());
  }, [marketFilter, signalFilter]);

  // KIS 데이터 로드
  const { data: kisData, isLoading: isLoadingKIS, error: kisError } = useQuery({
    queryKey: ['kis-data'],
    queryFn: fetchKISData,
  });

  // 분석 결과 로드
  const { data: analysisData } = useQuery({
    queryKey: ['kis-analysis'],
    queryFn: fetchKISAnalysis,
  });

  // 분석 결과를 코드별 맵으로 변환
  const analysisMap = useMemo(() => {
    if (!analysisData?.results) return {};
    return analysisData.results.reduce((acc, item) => {
      acc[item.code] = item;
      return acc;
    }, {} as Record<string, KISAnalysisResult>);
  }, [analysisData]);

  // 필터링된 종목 리스트
  const filteredStocks = useMemo(() => {
    if (!kisData?.stocks) return [];

    let stocks = Object.values(kisData.stocks);

    // 시장 필터
    if (marketFilter !== 'all') {
      stocks = stocks.filter(s => s.market.toLowerCase() === marketFilter);
    }

    // 시그널 필터
    if (signalFilter) {
      stocks = stocks.filter(s => {
        const analysis = analysisMap[s.code];
        return analysis?.signal === signalFilter;
      });
    }

    // 거래량 순위로 정렬
    return stocks.sort((a, b) => (a.ranking.volume_rank || 999) - (b.ranking.volume_rank || 999));
  }, [kisData, marketFilter, signalFilter, analysisMap]);

  // 시그널 카운트 (SignalCounts 타입에 맞춤)
  const signalCounts: SignalCounts = useMemo(() => {
    const counts: SignalCounts = {
      '적극매수': 0, '매수': 0, '중립': 0, '매도': 0, '적극매도': 0
    };
    if (analysisData?.results) {
      analysisData.results.forEach(r => {
        if (counts[r.signal] !== undefined) {
          counts[r.signal]++;
        }
      });
    }
    return counts;
  }, [analysisData]);

  // 시장별 카운트
  const marketCounts = useMemo(() => {
    if (!kisData?.stocks) return { all: 0, kospi: 0, kosdaq: 0 };
    const stocks = Object.values(kisData.stocks);
    return {
      all: stocks.length,
      kospi: stocks.filter(s => s.market === 'KOSPI').length,
      kosdaq: stocks.filter(s => s.market === 'KOSDAQ').length,
    };
  }, [kisData]);

  // 카드 확장/축소 토글
  const toggleCard = (code: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // 시그널 필터 토글
  const handleSignalFilter = (signal: SignalType) => {
    setSignalFilter(prev => prev === signal ? null : signal);
  };

  if (isLoadingKIS) {
    return (
      <section id="api-analysis" className="mb-10">
        <LoadingSpinner message="KIS 데이터 로딩 중..." />
      </section>
    );
  }

  if (kisError || !kisData) {
    return (
      <section id="api-analysis" className="mb-10">
        <EmptyState
          icon="📡"
          title="KIS API 데이터가 아직 없습니다"
          description="한국투자증권 API 연동이 설정되지 않았거나, 아직 데이터가 수집되지 않았습니다. GitHub Secrets에 KIS_APP_KEY, KIS_APP_SECRET을 설정한 후 워크플로우를 실행해주세요."
        />
      </section>
    );
  }

  const hasAnalysis = analysisData && analysisData.results.length > 0;

  return (
    <section id="api-analysis" className="mb-10">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-text-primary mb-1">한국투자증권 API 분석</h2>
          <p className="text-sm text-text-muted">실시간 API 기반 주식 데이터 분석</p>
        </div>
      </div>

      {/* 메타 정보 */}
      <ResultsMeta
        collectedAt={kisData.meta.original_collected_at}
        totalStocks={kisData.meta.total_stocks}
        analyzedCount={analysisData?.total_analyzed || 0}
      />

      {/* 시그널 요약 - Vision AI와 동일한 컴포넌트 사용 */}
      {hasAnalysis && (
        <>
          <SignalSummary
            counts={signalCounts}
            activeSignal={signalFilter}
            onFilter={handleSignalFilter}
          />
          <TipText>
            시그널 카드를 클릭하면 필터가 적용되어, 해당되는 종목만 확인 가능합니다
          </TipText>
        </>
      )}

      {!hasAnalysis && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <div className="font-medium text-amber-800">AI 분석 대기 중</div>
              <div className="text-sm text-amber-600">
                수집된 데이터에 대한 Gemini AI 분석이 아직 실행되지 않았습니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 시장 탭 */}
      <MarketTabs
        active={marketFilter}
        counts={marketCounts}
        onChange={setMarketFilter}
      />

      {/* 필터 인디케이터 */}
      <FilterIndicator
        signal={signalFilter}
        onClear={() => setSignalFilter(null)}
      />

      {/* 종목 그리드 */}
      {filteredStocks.length > 0 ? (
        <>
          <TipText>
            종목명을 클릭하면 네이버 금융으로 이동합니다
          </TipText>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
            {filteredStocks.map(stock => (
              <StockCard
                key={stock.code}
                stock={stock}
                analysis={analysisMap[stock.code]}
                isExpanded={expandedCards.has(stock.code)}
                onToggle={() => toggleCard(stock.code)}
              />
            ))}
          </div>
        </>
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
