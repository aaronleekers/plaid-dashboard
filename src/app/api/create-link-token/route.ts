import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import https from 'https';

const TELLER_APP_ID = process.env.TELLER_APP_ID || 'token_obmzypk2wucimgxlxijv4axyjm';

interface TellerEnrollment {
  id: string;
  url: string;
  message?: string;
}

interface TellerFetchResult {
  ok: boolean;
  data: unknown;
  status: number;
}

function getCerts() {
  // Try to read from environment variables (Vercel)
  const certB64 = process.env.TELLER_CERT_B64;
  const keyB64 = process.env.TELLER_KEY_B64;
  
  if (certB64 && keyB64) {
    return {
      cert: Buffer.from(certB64, 'base64'),
      key: Buffer.from(keyB64, 'base64'),
    };
  }
  
  // Fallback to local files (development)
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

export async function POST() {
  try {
    // Create enrollment to get connect URL
    const result = await tellerFetch('https://api.teller.io/enrollments', {
      method: 'POST',
      body: JSON.stringify({
        enrollment_type: 'bank',
        return_url: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/?connected=true',
      }),
    });

    if (!result.ok) {
      const errData = result.data as {message?: string} || {};
      console.error('Teller enrollment error:', result.data);
      return NextResponse.json({ 
        error: errData.message || 'Failed to create enrollment',
        details: result.data 
      }, { status: 500 });
    }

    const enrollment = result.data as TellerEnrollment;
    return NextResponse.json({ 
      enrollment_id: enrollment.id,
      url: enrollment.url 
    });
  } catch (error) {
    console.error('Error creating enrollment:', error);
    return NextResponse.json({ error: 'Failed to connect bank', details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await tellerFetch('https://api.teller.io/enrollments');
    return NextResponse.json({ enrollments: result.data || [] });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}
