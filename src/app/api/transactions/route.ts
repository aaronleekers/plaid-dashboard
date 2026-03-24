import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import https from 'https';

const TELLER_APP_ID = process.env.TELLER_APP_ID || 'token_obmzypk2wucimgxlxijv4axyjm';

interface TellerFetchResult {
  ok: boolean;
  data: unknown;
  status: number;
}

function getCerts() {
  const certB64 = process.env.TELLER_CERT_B64;
  const keyB64 = process.env.TELLER_KEY_B64;
  
  if (certB64 && keyB64) {
    return {
      cert: Buffer.from(certB64, 'base64'),
      key: Buffer.from(keyB64, 'base64'),
    };
  }
  
  const certPath = path.join(process.cwd(), 'certificate.pem');
  const keyPath = path.join(process.cwd(), 'private_key.pem');
  
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }
  
  return null;
}

function tellerFetch(url: string, options: RequestInit = {}): Promise<TellerFetchResult> {
  return new Promise((resolve, reject) => {
    const certs = getCerts();
    
    if (!certs) {
      reject(new Error('Teller certificates not found'));
      return;
    }

    const urlObj = new URL(url);
    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      cert: certs.cert,
      key: certs.key,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TELLER_APP_ID}:`).toString('base64'),
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
    const { account_id } = await request.json();

    if (!account_id) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    // Get transactions for the account
    const result = await tellerFetch(
      `https://api.teller.io/accounts/${account_id}/transactions?limit=50`
    );

    if (!result.ok) {
      console.error('Teller transactions error:', result.data);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    return NextResponse.json({ transactions: result.data || [] });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
