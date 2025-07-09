// File: src/App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import type { StatsData, TransactionData } from './types';
import StatsSummary from './components/StatsSummary';
import ProtocolChart from './components/ProtocolChart';
import TransactionsTable from './components/TransactionsTable';
import TopHolders from './components/TopHolders';
import RepeatedActivityWallets from './components/RepeatedActivityWallets';
type TopHolderData = {
  address: string;
  balance: number;
  holder_rank: number;
};
type RepeatedActivityWallet = {
  address: string;
  activity_count: number;
};

const API_BASE_URL = 'http://localhost:3001/api';

function App() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [topHolders, setTopHolders] = useState<TopHolderData[]>([]);
  const [repeatedWallets, setRepeatedWallets] = useState<RepeatedActivityWallet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async (startDate?: string, endDate?: string) => {
    let url = `${API_BASE_URL}/transactions`;
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [statsResponse, holdersResponse, repeatedResponse, transactionsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/stats`),
          fetch(`${API_BASE_URL}/top-holders`),
          fetch(`${API_BASE_URL}/repeated-activity`),
          fetchTransactions() // Initial fetch without filters
        ]);

        if (!statsResponse.ok || !transactionsResponse) {
          throw new Error('Failed to fetch initial data');
        }

        const statsData = await statsResponse.json();
        const holdersData = await holdersResponse.json();
        const repeatedData = await repeatedResponse.json();
        setStats(statsData);
        setTopHolders(holdersData);
        setRepeatedWallets(repeatedData);
        setTransactions(transactionsResponse);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleFilter = async (startDate: string, endDate: string) => {
    try {
      setLoading(true);
      setError(null);
      const filteredTransactions = await fetchTransactions(startDate, endDate);
      setTransactions(filteredTransactions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <div className="loader">Error: {error}</div>;
  }

  return (
    <div className="App">
      <h1>TokenWise Intelligence Dashboard</h1>
      {loading && !stats ? (
        <div className="loader">Loading Dashboard...</div>
      ) : (
        <>
          <div className="dashboard-grid">
            <StatsSummary stats={stats} />
            <ProtocolChart stats={stats} />
            <TopHolders holders={topHolders} />
            <RepeatedActivityWallets wallets={repeatedWallets} />
          </div>
          <div className="table-container">
            <TransactionsTable transactions={transactions} onFilter={handleFilter} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;