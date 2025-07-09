import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { Parser } from 'json2csv';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
const dbPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
});

// --- API Endpoints ---

app.get('/api/repeated-activity', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT wallet_address as address, COUNT(*) as activity_count
      FROM transactions
      GROUP BY wallet_address
      HAVING COUNT(*) > 1
      ORDER BY activity_count DESC
      LIMIT 20;
    `;
    const result = await dbPool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch repeated activity wallets:', err);
    res.status(500).json({ error: 'Failed to fetch repeated activity wallets' });
  }
});

app.get('/api/top-holders', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT wallet_address as address, token_balance as balance, holder_rank
      FROM top_holders
      ORDER BY holder_rank;
    `;
    const result = await dbPool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch top holders:', err);
    res.status(500).json({ error: 'Failed to fetch top holders' });
  }
});

app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const buysSellsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE transaction_type = 'buy') AS total_buys,
        COUNT(*) FILTER (WHERE transaction_type = 'sell') AS total_sells
      FROM transactions;
    `;
    const buysSellsResult = await dbPool.query(buysSellsQuery);

    const protocolQuery = `
      SELECT protocol, COUNT(*) as tx_count
      FROM transactions
      GROUP BY protocol
      ORDER BY tx_count DESC;
    `;
    const protocolResult = await dbPool.query(protocolQuery);
    const protocolBreakdown = protocolResult.rows.reduce((acc: Record<string, number>, row: any) => {
      acc[row.protocol] = parseInt(row.tx_count, 10);
      return acc;
    }, {} as Record<string, number>);

    const repeatedActivityQuery = `
      SELECT wallet_address, COUNT(*) as activity_count
      FROM transactions
      GROUP BY wallet_address
      HAVING COUNT(*) > 1
      ORDER BY activity_count DESC;
    `;
    const repeatedActivityResult = await dbPool.query(repeatedActivityQuery);

    res.json({
      ...buysSellsResult.rows[0],
      protocol_breakdown: protocolBreakdown,
      repeated_activity_wallets: repeatedActivityResult.rows,
    });
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/transactions', async (req: Request, res: Response) => {
  try {
    let { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    let query = 'SELECT * FROM transactions';
    const queryParams: any[] = [];

    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query += ' WHERE timestamp BETWEEN $1 AND $2';
      queryParams.push(startDate, end.toISOString().split('T')[0]);
    }

    query += ' ORDER BY timestamp DESC';
    const result = await dbPool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/export', async (req: Request, res: Response) => {
  try {
    let { startDate, endDate, format = 'csv' } = req.query as { startDate?: string; endDate?: string; format?: string };
    let query = 'SELECT signature, timestamp, wallet_address, transaction_type, protocol, token_amount, sol_usdc_amount FROM transactions';
    const queryParams: any[] = [];

    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query += ' WHERE timestamp BETWEEN $1 AND $2';
      queryParams.push(startDate, end.toISOString().split('T')[0]);
    }
    query += ' ORDER BY timestamp DESC';
    const result = await dbPool.query(query, queryParams);
    if (result.rows.length === 0) {
      return res.status(404).send('No data found for the selected range.');
    }
    if (format === 'csv') {
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(result.rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('tokenwise_export.csv');
      res.send(csv);
    } else if (format === 'json') {
      res.header('Content-Type', 'application/json');
      res.attachment('tokenwise_export.json');
      res.json(result.rows);
    } else {
      return res.status(400).json({ error: 'Invalid format. Must be either "csv" or "json".' });
    }
  } catch (err) {
    console.error('Failed to export data:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.listen(PORT, () => {
  console.log(`TokenWise API server running on http://localhost:${PORT}`);
}); 