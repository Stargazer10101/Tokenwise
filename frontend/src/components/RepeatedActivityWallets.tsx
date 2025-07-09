import React from 'react';
import './RepeatedActivityWallets.css';

interface RepeatedActivityWalletsProps {
  wallets: { address: string; activity_count: number }[];
}

const RepeatedActivityWallets: React.FC<RepeatedActivityWalletsProps> = ({ wallets }) => {
  return (
    <div className="card repeated-activity-wallets">
      <h2>Wallets with Repeated Activity</h2>
      <div className="wallets-list">
        <div className="wallets-header">
          <span className="address">Wallet Address</span>
          <span className="activity">Activity Count</span>
        </div>
        <div className="wallets-container">
          {wallets.map((wallet) => (
            <div key={wallet.address} className="wallet-item">
              <span className="address">{`${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`}</span>
              <span className="activity">{wallet.activity_count} transactions</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RepeatedActivityWallets;
