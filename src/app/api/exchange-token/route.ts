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
    const { public_token } = await request.json();
    
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });
    
    return NextResponse.json({ 
      access_token: response.data.access_token,
      item_id: response.data.item_id 
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
