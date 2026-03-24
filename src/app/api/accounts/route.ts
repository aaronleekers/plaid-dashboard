import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { NextRequest, NextResponse } from 'next/server';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '667289ef06b3ec0013c09df7',
      'PLAID-SECRET': process.env.PLAID_SECRET || '0b367a41d20ee3d346e2a6900af4d5',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(request: NextRequest) {
  try {
    const { access_token } = await request.json();
    
    const response = await plaidClient.accountsGet({
      access_token: access_token,
    });
    
    return NextResponse.json({ 
      accounts: response.data.accounts,
      institution: response.data.item 
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
