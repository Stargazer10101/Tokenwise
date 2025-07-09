// File: src/components/TransactionsTable.tsx
import React, { useState } from 'react';
import type { TransactionData } from '../types';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import './TransactionsTable.css';

interface TransactionsTableProps {
  transactions: TransactionData[];
  onFilter: (startDate: string, endDate: string) => void;
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({ transactions, onFilter }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');

  const handleFilterClick = () => {
    if (startDate && endDate) {
      onFilter(startDate, endDate);
    }
  };

  const handleExportClick = () => {
    const url = `http://localhost:3001/api/export?startDate=${startDate}&endDate=${endDate}&format=${exportFormat}`;
    window.open(url, '_blank');
  };

  return (
    <div className="card table-container">
      <h2>Transaction History</h2>
      <div className="filters">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button onClick={handleFilterClick}>Filter</button>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Format</InputLabel>
          <Select
            value={exportFormat}
            label="Format"
            onChange={(e) => setExportFormat(e.target.value)}
          >
            <MenuItem value="csv">CSV</MenuItem>
            <MenuItem value="json">JSON</MenuItem>
          </Select>
        </FormControl>
        <button onClick={handleExportClick}>Export</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Signature</th>
            <th>Timestamp</th>
            <th>Wallet</th>
            <th>Type</th>
            <th>Protocol</th>
            <th>Token Amount</th>
            <th>SOL/USDC Amount</th>
          </tr>
        </thead>
      </table>
      <div className="transactions-table-scroll">
        <table>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.signature}>
                <td>{tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}</td>
                <td>{tx.timestamp}</td>
                <td>{tx.wallet_address.slice(0, 4)}...{tx.wallet_address.slice(-4)}</td>
                <td>{tx.transaction_type}</td>
                <td>{tx.protocol}</td>
                <td>{tx.token_amount}</td>
                <td>{tx.sol_usdc_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionsTable;