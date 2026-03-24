import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { NextResponse } from 'next/server';

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

export async function POST() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'user-sandbox' },
      client_name: 'Plaid Dashboard',
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
