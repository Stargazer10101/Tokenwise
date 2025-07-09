import 'dotenv/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { Pool } from 'pg';

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL!;
const TOKEN_MINT_ADDRESS = process.env.TOKEN_MINT_ADDRESS!;
const TOP_HOLDERS_LIMIT = 60;

const solanaConnection = new Connection(HELIUS_RPC_URL, 'confirmed');
const dbPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
});

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface HolderData {
  wallet_address: string;
  token_balance: number;
  holder_rank: number;
}

async function main() {
  let dbClient: any;
  try {
    dbClient = await dbPool.connect();
    console.log('Successfully connected to PostgreSQL database.');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS top_holders (
        wallet_address TEXT PRIMARY KEY,
        token_balance NUMERIC,
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        holder_rank INTEGER
      );
    `;
    await dbClient.query(createTableQuery);
    console.log('Table "top_holders" is ready.');
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'top_holders' AND column_name = 'holder_rank';
    `;
    const columnExists = await dbClient.query(checkColumnQuery);
    if (columnExists.rows.length === 0) {
      console.log('Adding holder_rank column to existing table...');
      await dbClient.query('ALTER TABLE top_holders ADD COLUMN holder_rank INTEGER;');
    }
    await dbClient.query('DELETE FROM top_holders');
    console.log('Cleared existing holder data.');
    console.log(`Fetching top holders for token: ${TOKEN_MINT_ADDRESS}...`);
    const largestAccounts = await solanaConnection.getTokenLargestAccounts(
      new PublicKey(TOKEN_MINT_ADDRESS)
    );
    console.log(`Found ${largestAccounts.value.length} largest token accounts.`);
    const holderData: HolderData[] = [];
    console.log('Processing token accounts to find wallet owners...');
    for (let i = 0; i < largestAccounts.value.length && holderData.length < TOP_HOLDERS_LIMIT; i++) {
      const account = largestAccounts.value[i];
      try {
        const accountInfo = await solanaConnection.getParsedAccountInfo(account.address);
        if (accountInfo.value && accountInfo.value.data && 'parsed' in accountInfo.value.data) {
          const owner = (accountInfo.value.data as any).parsed.info.owner;
          const balance = (accountInfo.value.data as any).parsed.info.tokenAmount.uiAmount;
          const BURN_ADDRESSES = [
            '11111111111111111111111111111111',
            '1111111111111111111111111111111',
          ];
          if (balance > 0 && !BURN_ADDRESSES.includes(owner)) {
            if (typeof owner === 'string' && owner.length > 0 && typeof balance === 'number' && !isNaN(balance)) {
              holderData.push({
                wallet_address: owner,
                token_balance: balance,
                holder_rank: holderData.length + 1
              });
              console.log(`  -> Rank ${holderData.length}: ${owner} with balance: ${balance}`);
            } else {
              console.log(`  -> Skipping invalid data: owner=${owner}, balance=${balance}`);
            }
          }
        }
        await delay(100);
      } catch (error: any) {
        console.error(`Error processing account ${account.address}:`, error.message);
      }
    }
    console.log(`\nProcessed ${holderData.length} valid holders (target: ${TOP_HOLDERS_LIMIT})`);
    console.log(`\nStoring top ${holderData.length} holders in database...`);
    for (const holder of holderData) {
      try {
        const upsertQuery = `
          INSERT INTO top_holders (wallet_address, token_balance, last_updated, holder_rank)
          VALUES ($1, $2, NOW(), $3)
          ON CONFLICT (wallet_address)
          DO UPDATE SET
            token_balance = EXCLUDED.token_balance,
            last_updated = NOW(),
            holder_rank = EXCLUDED.holder_rank;
        `;
        await dbClient.query(upsertQuery, [
          holder.wallet_address,
          holder.token_balance,
          holder.holder_rank
        ]);
        console.log(`  ✅ Stored holder ${holder.holder_rank}: ${holder.wallet_address.slice(0, 8)}...`);
      } catch (dbError: any) {
        console.error(`❌ Error storing holder ${holder.holder_rank} (${holder.wallet_address}):`, dbError.message);
        console.error(`   Balance: ${holder.token_balance}, Rank: ${holder.holder_rank}`);
      }
    }
    const countResult = await dbClient.query('SELECT COUNT(*) FROM top_holders');
    const totalHolders = countResult.rows[0].count;
    console.log(`\n✅ Successfully discovered and stored ${totalHolders} top holders.`);
    console.log(`📊 These are the top ${Math.min(TOP_HOLDERS_LIMIT, totalHolders)} token holders by balance.`);
    const topTenResult = await dbClient.query(`
      SELECT wallet_address, token_balance, holder_rank 
      FROM top_holders 
      ORDER BY holder_rank 
      LIMIT 10
    `);
    console.log('\n🏆 Top 10 holders:');
    topTenResult.rows.forEach((row: any) => {
      console.log(`  ${row.holder_rank}. ${row.wallet_address} - ${row.token_balance} tokens`);
    });
  } catch (error: any) {
    console.error('An error occurred:', error);
  } finally {
    if (dbClient) {
      dbClient.release();
      console.log('\nDatabase client released.');
    }
    await dbPool.end();
    console.log('Database connection pool closed.');
  }
}

main(); 