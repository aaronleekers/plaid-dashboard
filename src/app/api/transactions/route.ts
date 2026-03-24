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
    const { account_id } = await request.json();
    const token = await getTellerToken();

    if (!account_id) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    // Get transactions for the account
    const response = await fetch(
      `https://api.teller.io/accounts/${account_id}/transactions?limit=50`,
      { headers: { 'Authorization': token } }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Teller transactions error:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    const transactions = await response.json();

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
