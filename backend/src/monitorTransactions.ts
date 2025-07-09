import 'dotenv/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { Pool } from 'pg';
import logger from './logger';

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL!;
const TOKEN_MINT_ADDRESS = process.env.TOKEN_MINT_ADDRESS!;

// Polling intervals based on wallet activity
const ACTIVE_WALLET_INTERVAL = 30000; // 30 seconds
const MODERATE_WALLET_INTERVAL = 120000; // 2 minutes
const INACTIVE_WALLET_INTERVAL = 600000; // 10 minutes
const PROCESSOR_INTERVAL_MS = 100;

// Activity thresholds
const ACTIVE_THRESHOLD = 5; // transactions in last hour
const MODERATE_THRESHOLD = 1; // transactions in last 6 hours

const QUOTE_CURRENCIES: Record<string, string> = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
};

// Protocol detection based on program addresses
const PROTOCOL_PROGRAMS: Record<string, string> = {
  // Jupiter
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  'JUP4jdqG9gCgxUkYAFyDfgdCLqZHqjJbF5fGSPxUPa7': 'Jupiter',
  'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo': 'Jupiter',
  
  // Raydium  
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Raydium',
  'EhYXq3ANp5nAerUpbSud7VxbWJJwHGyP7qALJLuJ5hs': 'Raydium',
  'HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8': 'Raydium',
  '27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv': 'Raydium',
  
  // Orca
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca',
  'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'Orca',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Orca',
  
  // Meteora
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': 'Meteora',
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'Meteora',
  
  // Lifinity
  'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S': 'Lifinity',
  
  // Aldrin
  'AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6': 'Aldrin',
  
  // Saber
  'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ': 'Saber',
  
  // Serum/OpenBook
  'EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o': 'Serum',
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX': 'Serum',
  
  // Pump.fun
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun',
  
  // Moonshot
  'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG': 'Moonshot',
};

interface WalletActivity {
  address: string;
  lastActivity: number;
  recentTransactions: number;
  activityLevel: 'active' | 'moderate' | 'inactive';
  lastPolled: number;
  consecutiveEmptyPolls: number;
}

interface PriorityTransaction {
  signature: string;
  priority: number;
  timestamp: number;
  walletAddress: string;
}

class PriorityQueue {
  private queue: PriorityTransaction[] = [];
  private processedSignatures = new Set<string>();

  add(signature: string, priority: number, walletAddress: string) {
    if (this.processedSignatures.has(signature)) return;
    
    this.queue.push({
      signature,
      priority,
      timestamp: Date.now(),
      walletAddress
    });
    
    this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
  }

  next(): PriorityTransaction | null {
    const item = this.queue.shift();
    if (item) {
      this.processedSignatures.add(item.signature);
    }
    return item || null;
  }

  size(): number {
    return this.queue.length;
  }

  hasProcessed(signature: string): boolean {
    return this.processedSignatures.has(signature);
  }
}

const priorityQueue = new PriorityQueue();
const walletsActivity = new Map<string, WalletActivity>();
const lastSignatures = new Map<string, string>();

const solanaConnection = new Connection(HELIUS_RPC_URL, { commitment: 'confirmed' });
const dbPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
});

class SmartRateLimiter {
  maxRequests: number;
  windowMs: number;
  requestTimestamps: number[];
  requestQueue: any[];
  isProcessing: boolean;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requestTimestamps = [];
    this.requestQueue = [];
    this.isProcessing = false;
  }

  async makeRequest<T>(requestFn: () => Promise<T>, priority: number = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject, priority });
      this.requestQueue.sort((a, b) => b.priority - a.priority);
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    this.isProcessing = true;
    while (this.requestQueue.length > 0) {
      const now = Date.now();
      this.requestTimestamps = this.requestTimestamps.filter(time => now - time < this.windowMs);
      
      if (this.requestTimestamps.length >= this.maxRequests) {
        const timeToWait = (this.requestTimestamps[0] + this.windowMs) - now;
        await new Promise(resolve => setTimeout(resolve, Math.max(timeToWait, 100)));
        continue;
      }
      
      const { requestFn, resolve, reject } = this.requestQueue.shift();
      this.requestTimestamps.push(Date.now());
      
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    this.isProcessing = false;
  }
}

const heliusRateLimiter = new SmartRateLimiter(8, 1000);

async function initializeState(pool: Pool) {
  const result = await pool.query('SELECT wallet_address FROM top_holders');
  
  for (const row of result.rows) {
    const walletAddress = row.wallet_address;
    walletsActivity.set(walletAddress, {
      address: walletAddress,
      lastActivity: 0,
      recentTransactions: 0,
      activityLevel: 'inactive',
      lastPolled: 0,
      consecutiveEmptyPolls: 0
    });
  }
  
  // Get recent transaction counts to classify wallets
  await updateWalletActivityLevels();
  
  logger.info(`Initialized with ${walletsActivity.size} wallets to monitor.`);
  logActivityDistribution();
}

async function updateWalletActivityLevels() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
  
  for (const [walletAddress, activity] of walletsActivity) {
    try {
      const result = await dbPool.query(
        'SELECT COUNT(*) as count FROM transactions WHERE wallet_address = $1 AND timestamp > $2',
        [walletAddress, new Date(oneHourAgo).toISOString()]
      );
      
      const recentCount = parseInt(result.rows[0].count);
      
      if (recentCount >= ACTIVE_THRESHOLD) {
        activity.activityLevel = 'active';
      } else {
        const moderateResult = await dbPool.query(
          'SELECT COUNT(*) as count FROM transactions WHERE wallet_address = $1 AND timestamp > $2',
          [walletAddress, new Date(sixHoursAgo).toISOString()]
        );
        
        const moderateCount = parseInt(moderateResult.rows[0].count);
        activity.activityLevel = moderateCount >= MODERATE_THRESHOLD ? 'moderate' : 'inactive';
      }
      
      activity.recentTransactions = recentCount;
    } catch (error) {
      logger.error(`Error updating activity for wallet ${walletAddress}:`, error);
    }
  }
}

function logActivityDistribution() {
  const distribution = Array.from(walletsActivity.values()).reduce((acc, wallet) => {
    acc[wallet.activityLevel] = (acc[wallet.activityLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  logger.info(`Wallet Activity Distribution: Active: ${distribution.active || 0}, Moderate: ${distribution.moderate || 0}, Inactive: ${distribution.inactive || 0}`);
}

function identifyProtocol(transaction: any, logMessages: string[]): string {
  // Method 1: Check involved program addresses
  const involvedPrograms = transaction.message.instructions
    .map((instruction: any) => instruction.programId.toBase58())
    .concat(
      transaction.message.accountKeys
        .filter((acc: any) => acc.executable)
        .map((acc: any) => acc.pubkey.toBase58())
    );
  
  // Check for protocol programs
  for (const programId of involvedPrograms) {
    if (PROTOCOL_PROGRAMS[programId]) {
      return PROTOCOL_PROGRAMS[programId];
    }
  }
  
  // Method 2: Check inner instructions for program invocations
  if (transaction.meta?.innerInstructions) {
    for (const innerInstructionSet of transaction.meta.innerInstructions) {
      for (const instruction of innerInstructionSet.instructions) {
        const programId = instruction.programId?.toBase58() || 
                         transaction.message.accountKeys[instruction.programIdIndex]?.pubkey?.toBase58();
        
        if (programId && PROTOCOL_PROGRAMS[programId]) {
          return PROTOCOL_PROGRAMS[programId];
        }
      }
    }
  }
  
  // Method 3: Check account keys for known program addresses
  for (const accountKey of transaction.message.accountKeys) {
    const address = accountKey.pubkey.toBase58();
    if (PROTOCOL_PROGRAMS[address]) {
      return PROTOCOL_PROGRAMS[address];
    }
  }
  
  // Method 4: Fallback to log message analysis (improved)
  const combinedLogs = logMessages.join(' ').toLowerCase();
  
  // Check for Jupiter-specific patterns
  if (combinedLogs.includes('jupiter') || combinedLogs.includes('jup') || 
      combinedLogs.includes('swap aggregator') || combinedLogs.includes('route')) {
    return 'Jupiter';
  }
  
  // Check for Raydium-specific patterns
  if (combinedLogs.includes('raydium') || combinedLogs.includes('ray') ||
      combinedLogs.includes('amm') || combinedLogs.includes('liquidity pool')) {
    return 'Raydium';
  }
  
  // Check for Orca-specific patterns
  if (combinedLogs.includes('orca') || combinedLogs.includes('whirlpool') ||
      combinedLogs.includes('whirl')) {
    return 'Orca';
  }
  
  // Check for Meteora patterns
  if (combinedLogs.includes('meteora') || combinedLogs.includes('meteor')) {
    return 'Meteora';
  }
  
  // Check for Pump.fun patterns
  if (combinedLogs.includes('pump') || combinedLogs.includes('bonding curve')) {
    return 'Pump.fun';
  }
  
  // Check for Serum/OpenBook patterns
  if (combinedLogs.includes('serum') || combinedLogs.includes('openbook') ||
      combinedLogs.includes('order book')) {
    return 'Serum';
  }
  
  return 'Unknown';
}

async function getParsedTransactionRateLimited(signature: string, priority: number = 0) {
  return heliusRateLimiter.makeRequest(() =>
    solanaConnection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 }),
    priority
  );
}

async function processTransaction(item: PriorityTransaction) {
  try {
    const tx = await getParsedTransactionRateLimited(item.signature, item.priority);
    if (!tx || !tx.meta) return;
    
    const { meta, transaction, blockTime } = tx;
    const involvedWallets = transaction.message.accountKeys.map((acc: any) => acc.pubkey.toBase58());
    const monitoredWallet = involvedWallets.find((address: string) => walletsActivity.has(address));
    
    if (!monitoredWallet) return;
    
    // Update wallet activity
    const walletActivity = walletsActivity.get(monitoredWallet);
    if (walletActivity) {
      walletActivity.lastActivity = Date.now();
      walletActivity.recentTransactions++;
    }
    
    let targetTokenChange = 0;
    const preTarget = meta.preTokenBalances?.find((b: any) => b.mint === TOKEN_MINT_ADDRESS && b.owner === monitoredWallet);
    const postTarget = meta.postTokenBalances?.find((b: any) => b.mint === TOKEN_MINT_ADDRESS && b.owner === monitoredWallet);
    
    if (preTarget || postTarget) {
      targetTokenChange = (postTarget?.uiTokenAmount?.uiAmount || 0) - (preTarget?.uiTokenAmount?.uiAmount || 0);
    }
    
    if (Math.abs(targetTokenChange) < 1e-9) return;
    
    let quoteTokenChange = 0;
    for (const mint of Object.keys(QUOTE_CURRENCIES)) {
      const preQuote = meta.preTokenBalances?.find((b: any) => b.mint === mint && b.owner === monitoredWallet);
      const postQuote = meta.postTokenBalances?.find((b: any) => b.mint === mint && b.owner === monitoredWallet);
      
      if (preQuote || postQuote) {
        const change = (postQuote?.uiTokenAmount?.uiAmount || 0) - (preQuote?.uiTokenAmount?.uiAmount || 0);
        if (Math.abs(change) > 1e-9) {
          quoteTokenChange = change;
          break;
        }
      }
    }
    
    const transactionType = targetTokenChange > 0 ? 'buy' : 'sell';
    const protocol = identifyProtocol(transaction, Array.isArray(meta.logMessages) ? meta.logMessages : []);
    
    const transactionData = {
      signature: item.signature,
      timestamp: blockTime ? new Date(blockTime * 1000).toISOString() : '',
      wallet_address: monitoredWallet,
      transaction_type: transactionType,
      protocol: protocol,
      token_amount: Math.abs(targetTokenChange),
      sol_usdc_amount: Math.abs(quoteTokenChange),
    };
    
    const insertQuery = `INSERT INTO transactions VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (signature) DO NOTHING;`;
    await dbPool.query(insertQuery, Object.values(transactionData));
    
    logger.info(`[✅ Stored] ${transactionType.toUpperCase()} of ${transactionData.token_amount.toFixed(2)} by ${monitoredWallet.slice(0, 4)}... on ${protocol} (Priority: ${item.priority})`);
  } catch (error: any) {
    if (error.code !== '23505') {
      logger.error(`[❌ Processor Error @ ${item.signature.slice(0, 10)}...]:`, error.message);
    }
  }
}

async function fetchSignaturesForWallet(walletAddress: string, activity: WalletActivity) {
  try {
    const publicKey = new PublicKey(walletAddress);
    const lastSeenSignature = lastSignatures.get(walletAddress);
    
    // Adjust limit based on activity level
    const limit = activity.activityLevel === 'active' ? 50 : 
                 activity.activityLevel === 'moderate' ? 25 : 10;
    
    const signatures = await heliusRateLimiter.makeRequest(() =>
      solanaConnection.getSignaturesForAddress(publicKey, { 
        until: lastSeenSignature, 
        limit 
      }),
      activity.activityLevel === 'active' ? 3 : 
      activity.activityLevel === 'moderate' ? 2 : 1
    );
    
    if (signatures && signatures.length > 0) {
      // Calculate priority based on wallet activity and transaction age
      const basePriority = activity.activityLevel === 'active' ? 100 : 
                          activity.activityLevel === 'moderate' ? 50 : 10;
      
      signatures.forEach((sigInfo: any, index: number) => {
        const priority = basePriority + (signatures.length - index);
        priorityQueue.add(sigInfo.signature, priority, walletAddress);
      });
      
      lastSignatures.set(walletAddress, signatures[0].signature);
      activity.lastPolled = Date.now();
      activity.consecutiveEmptyPolls = 0;
      
      logger.info(`[+] Found ${signatures.length} new signature(s) for ${activity.activityLevel} wallet ${walletAddress.slice(0, 4)}... Queue size: ${priorityQueue.size()}`);
    } else {
      activity.consecutiveEmptyPolls++;
      activity.lastPolled = Date.now();
      
      // Demote wallet if consistently empty
      if (activity.consecutiveEmptyPolls >= 5 && activity.activityLevel === 'active') {
        activity.activityLevel = 'moderate';
        logger.info(`[📉] Demoted wallet ${walletAddress.slice(0, 4)}... to moderate due to inactivity`);
      } else if (activity.consecutiveEmptyPolls >= 10 && activity.activityLevel === 'moderate') {
        activity.activityLevel = 'inactive';
        logger.info(`[📉] Demoted wallet ${walletAddress.slice(0, 4)}... to inactive due to inactivity`);
      }
    }
  } catch (error: any) {
    logger.error(`[❌ Fetcher Error] Failed to process wallet: ${walletAddress}.`, error);
  }
}

async function smartPollingLoop() {
  const now = Date.now();
  const walletsToCheck: [string, WalletActivity][] = [];
  
  for (const [walletAddress, activity] of walletsActivity) {
    let intervalToUse: number;
    
    switch (activity.activityLevel) {
      case 'active':
        intervalToUse = ACTIVE_WALLET_INTERVAL;
        break;
      case 'moderate':
        intervalToUse = MODERATE_WALLET_INTERVAL;
        break;
      default:
        intervalToUse = INACTIVE_WALLET_INTERVAL;
        break;
    }
    
    if (now - activity.lastPolled >= intervalToUse) {
      walletsToCheck.push([walletAddress, activity]);
    }
  }
  
  if (walletsToCheck.length > 0) {
    logger.info(`[🔎 Fetcher] Checking ${walletsToCheck.length} wallets due for polling...`);
    
    // Process wallets in order of activity level
    walletsToCheck.sort((a, b) => {
      const priorityOrder = { active: 3, moderate: 2, inactive: 1 };
      return priorityOrder[b[1].activityLevel] - priorityOrder[a[1].activityLevel];
    });
    
    for (const [walletAddress, activity] of walletsToCheck) {
      await fetchSignaturesForWallet(walletAddress, activity);
    }
  }
}

async function main() {
  logger.info('Starting Enhanced TokenWise Polling Service with Activity-Based Polling...');
  
  await initializeState(dbPool);
  
  // Start polling loop
  logger.info('Starting Polling Loop...');
  smartPollingLoop();
  setInterval(smartPollingLoop, 5000); // Check every 5 seconds which wallets need polling
  
  // Update activity levels periodically
  setInterval(updateWalletActivityLevels, 300000); // Every 5 minutes
  setInterval(logActivityDistribution, 60000); // Every minute
  
  // Start processor loop
  logger.info(`Starting Processor loop (runs every ${PROCESSOR_INTERVAL_MS}ms)...`);
  setInterval(() => {
    const item = priorityQueue.next();
    if (item) {
      processTransaction(item);
    }
  }, PROCESSOR_INTERVAL_MS);
  
  logger.info('\n🚀 Service is live. Fetching and priority processing active...\n');
  
  process.on('SIGINT', () => {
    logger.info('\nShutting down ...');
    dbPool.end(() => {
      logger.info('Database pool has been closed.');
      process.exit(0);
    });
  });
}

main().catch(error => {
  logger.error('An unhandled error occurred in the main execution block.', { stack: (error as any).stack });
  process.exit(1);
});