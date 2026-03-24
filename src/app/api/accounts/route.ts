import { NextRequest, NextResponse } from 'next/server';

async function getTellerToken() {
  const appId = process.env.TELLER_APP_ID;
  const secret = process.env.TELLER_SECRET;
  
  if (!appId || !secret) {
    throw new Error('Teller credentials not configured');
  }
  
  return 'Basic ' + Buffer.from(`${appId}:${secret}`).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const { enrollment_id } = await request.json();
    const token = await getTellerToken();

    // Get accounts for the enrollment
    const response = await fetch(`https://api.teller.io/enrollments/${enrollment_id}/accounts`, {
      headers: {
        'Authorization': token,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Teller accounts error:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    const accounts = await response.json();
    
    // Get balances for each account
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account: any) => {
        const balanceResponse = await fetch(
          `https://api.teller.io/accounts/${account.id}/balances`,
          { headers: { 'Authorization': token } }
        );
        const balance = await balanceResponse.json();
        return { ...account, balances: balance };
      })
    );

    return NextResponse.json({ accounts: accountsWithBalances });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const token = await getTellerToken();

    // List all accounts
    const response = await fetch('https://api.teller.io/accounts', {
      headers: {
        'Authorization': token,
      },
    });

    const accounts = await response.json();
    
    // Get balances for each account
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account: any) => {
        const balanceResponse = await fetch(
          `https://api.teller.io/accounts/${account.id}/balances`,
          { headers: { 'Authorization': token } }
        );
        const balance = await balanceResponse.json();
        return { ...account, balances: balance };
      })
    );

    return NextResponse.json({ accounts: accountsWithBalances });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
