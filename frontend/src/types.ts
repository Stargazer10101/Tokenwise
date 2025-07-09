// File: src/types.ts

export interface StatsData {
  total_buys: string;
  total_sells: string;
  protocol_breakdown: { [key: string]: number };
  repeated_activity_wallets: { wallet_address: string; activity_count: string }[];
}

export interface TransactionData {
  signature: string;
  timestamp: string;
  wallet_address: string;
  transaction_type: 'buy' | 'sell';
  protocol: string;
  token_amount: string;
  sol_usdc_amount: string;
}