import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import https from 'https';

const TELLER_APP_ID = process.env.TELLER_APP_ID || 'token_obmzypk2wucimgxlxijv4axyjm';

interface TellerAccount {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  currency: string;
  balances?: {
    available: string;
    current: string;
    limit: string | null;
  };
}

interface TellerFetchResult {
  ok: boolean;
  data: unknown;
  status: number;
}

function tellerFetch(url: string, options: RequestInit = {}): Promise<TellerFetchResult> {
  return new Promise((resolve, reject) => {
    const certPath = path.join(process.cwd(), 'certificate.pem');
    const keyPath = path.join(process.cwd(), 'private_key.pem');
    
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      reject(new Error('Teller certificates not found'));
      return;
    }

    const urlObj = new URL(url);
    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      headers: {
        'Authorization': `Bearer ${TELLER_APP_ID}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200 || res.statusCode === 201, data: JSON.parse(data), status: res.statusCode ?? 0 });
        } catch {
          resolve({ ok: false, data, status: res.statusCode ?? 0 });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const { enrollment_id } = await request.json();

    // Get accounts for the enrollment
    const result = await tellerFetch(`https://api.teller.io/enrollments/${enrollment_id}/accounts`);

    if (!result.ok) {
      console.error('Teller accounts error:', result.data);
      return NextResponse.json({ error: 'Failed to fetch accounts', details: result.data }, { status: 500 });
    }

    const accounts = (result.data as TellerAccount[]) || [];
    
    // Get balances for each account
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        try {
          const balanceResult = await tellerFetch(`https://api.teller.io/accounts/${account.id}/balances`);
          const balance = balanceResult.data as TellerAccount['balances'] || {};
          return { ...account, balances: balance };
        } catch {
          return { ...account, balances: {} };
        }
      })
    );

    return NextResponse.json({ accounts: accountsWithBalances });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts', details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await tellerFetch('https://api.teller.io/accounts');

    if (!result.ok) {
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    const accounts = (result.data as TellerAccount[]) || [];
    
    // Get balances for each account
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        try {
          const balanceResult = await tellerFetch(`https://api.teller.io/accounts/${account.id}/balances`);
          return { ...account, balances: balanceResult.data as TellerAccount['balances'] || {} };
        } catch {
          return { ...account, balances: {} };
        }
      })
    );

    return NextResponse.json({ accounts: accountsWithBalances });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
