import { SignalBadge } from '@/components/signal';
import { formatTimeOnly } from '@/lib/utils';
import type { StockResult } from '@/services/types';

interface StockTableProps {
  stocks: StockResult[];
}

export function StockTable({ stocks }: StockTableProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden shadow-sm hidden md:block">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="bg-bg-primary px-4 py-3 text-left text-xs font-bold text-text-muted uppercase border-b border-border whitespace-nowrap">
              종목
            </th>
            <th className="bg-bg-primary px-4 py-3 text-left text-xs font-bold text-text-muted uppercase border-b border-border whitespace-nowrap">
              시그널
            </th>
            <th className="bg-bg-primary px-4 py-3 text-left text-xs font-bold text-text-muted uppercase border-b border-border">
              분석 근거
            </th>
            <th className="bg-bg-primary px-4 py-3 text-left text-xs font-bold text-text-muted uppercase border-b border-border whitespace-nowrap">
              시각
            </th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.code} className="hover:bg-bg-primary">
              <td className="px-4 py-3.5 border-b border-border-light align-middle whitespace-nowrap">
                <a
                  href={`https://m.stock.naver.com/domestic/stock/${stock.code}/total`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-inherit no-underline hover:text-accent-primary hover:underline transition-colors"
                >
                  <div className="font-semibold text-text-primary text-sm">{stock.name}</div>
                  <div className="text-xs text-text-muted font-mono mt-0.5">{stock.code}</div>
                </a>
              </td>
              <td className="px-4 py-3.5 border-b border-border-light align-middle whitespace-nowrap">
                <SignalBadge signal={stock.signal} />
              </td>
              <td className="px-4 py-3.5 border-b border-border-light align-middle">
                <div className="text-sm text-text-secondary leading-relaxed">
                  {stock.reason || '-'}
                </div>
              </td>
              <td className="px-4 py-3.5 border-b border-border-light align-middle whitespace-nowrap">
                <div className="text-xs text-text-muted leading-relaxed">
                  {stock.capture_time && (
                    <div>캡처: {formatTimeOnly(stock.capture_time)}</div>
                  )}
                  {stock.analysis_time && (
                    <div>분석: {formatTimeOnly(stock.analysis_time)}</div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
