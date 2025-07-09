// File: src/components/StatsSummary.tsx
import React from 'react';
import type { StatsData } from '../types';

interface StatsSummaryProps {
  stats: StatsData | null;
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ stats }) => {
  if (!stats) return null;

  const totalBuys = parseInt(stats.total_buys, 10);
  const totalSells = parseInt(stats.total_sells, 10);
  const netDirection = totalBuys - totalSells;

  return (
    <div className="card">
      <h2>Market Pulse</h2>
      <p><strong>Total Buys:</strong> {totalBuys.toLocaleString()}</p>
      <p><strong>Total Sells:</strong> {totalSells.toLocaleString()}</p>
      <p>
        <strong>Net Direction:</strong>
        <span style={{ color: netDirection > 0 ? '#4caf50' : '#f44336', marginLeft: '8px' }}>
          {netDirection.toLocaleString()} ({netDirection > 0 ? 'Buy-Heavy' : 'Sell-Heavy'})
        </span>
      </p>
    </div>
  );
};

export default StatsSummary;