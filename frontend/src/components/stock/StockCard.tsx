import { SignalBadge } from '@/components/signal';
import { formatTimeOnly } from '@/lib/utils';
import type { StockResult } from '@/services/types';

interface StockCardProps {
  stock: StockResult;
}

export function StockCard({ stock }: StockCardProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-3 md:p-4 mb-2.5 md:mb-3">
      <div className="flex justify-between items-start mb-2.5 md:mb-3">
        <a
          href={`https://m.stock.naver.com/domestic/stock/${stock.code}/total`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 text-inherit no-underline hover:text-accent-primary transition-colors"
        >
          <div className="font-semibold text-sm md:text-base text-text-primary truncate">{stock.name}</div>
          <div className="text-xs md:text-sm text-text-muted font-mono">{stock.code}</div>
        </a>
        <SignalBadge signal={stock.signal} />
      </div>
      <div className="text-xs md:text-sm text-text-secondary leading-relaxed pt-2.5 md:pt-3 border-t border-border-light">
        {stock.reason || '-'}
      </div>
      <div className="text-[0.65rem] md:text-xs text-text-muted mt-2 md:mt-2.5 flex gap-2 md:gap-3">
        {stock.capture_time && <span>캡처 {formatTimeOnly(stock.capture_time)}</span>}
        {stock.analysis_time && <span>분석 {formatTimeOnly(stock.analysis_time)}</span>}
      </div>
    </div>
  );
}
