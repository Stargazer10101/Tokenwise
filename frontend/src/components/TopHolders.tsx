import React from 'react';
import './TopHolders.css';

interface TopHoldersProps {
  holders: { address: string; balance: number; holder_rank: number }[];
}

const TopHolders: React.FC<TopHoldersProps> = ({ holders }) => {
  return (
    <div className="card top-holders">
      <h2>Top Holders</h2>
      <div className="holders-list">
        <div className="holders-header">
          <span className="rank">Rank</span>
          <span className="address">Wallet Address</span>
          <span className="balance">Balance</span>
        </div>
        <div className="holders-container">
          {holders.map((holder) => (
            <div key={holder.address} className="holder-item">
              <span className="rank">#{holder.holder_rank}</span>
              <span className="address">{holder.address}</span>
              <span className="balance">{holder.balance.toLocaleString()} tokens</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopHolders;
