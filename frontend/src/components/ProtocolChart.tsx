// File: src/components/ProtocolChart.tsx
import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import type { StatsData } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProtocolChartProps {
  stats: StatsData | null;
}

const ProtocolChart: React.FC<ProtocolChartProps> = ({ stats }) => {
  if (!stats || !stats.protocol_breakdown) return null;

  const data = {
    labels: Object.keys(stats.protocol_breakdown),
    datasets: [{
      data: Object.values(stats.protocol_breakdown),
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
      hoverBackgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
    }],
  };

  return (
    <div className="card">
      <h2>Protocol Usage</h2>
      <Doughnut data={data} />
    </div>
  );
};

export default ProtocolChart;