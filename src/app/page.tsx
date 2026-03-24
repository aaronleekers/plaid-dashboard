'use client';

import { useState, useEffect } from 'react';
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';

interface Account {
  account_id: string;
  name: string;
  official_name: string;
  type: string;
  subtype: string;
  balances: {
    available: number | null;
    current: number;
    iso_currency_code: string;
  };
}

interface Transaction {
  transaction_id: string;
  name: string;
  merchant_name: string;
  amount: number;
  date: string;
  category: string[];
  pending: boolean;
}

export default function Home() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('plaid_access_token');
    if (stored) {
      setAccessToken(stored);
    }
    fetchLinkToken();
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchAccounts(accessToken);
      fetchTransactions(accessToken);
    }
  }, [accessToken]);

  const fetchLinkToken = async () => {
    try {
      const response = await fetch('/api/create-link-token', { method: 'POST' });
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error fetching link token:', error);
    }
  };

  const fetchAccounts = async (token: string) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      });
      const data = await response.json();
      setAccounts(data.accounts || []);
      const total = (data.accounts || []).reduce(
        (sum: number, acc: Account) => sum + (acc.balances?.current || 0),
        0
      );
      setTotalBalance(total);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchTransactions = async (token: string) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      });
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const onSuccess: PlaidLinkOnSuccess = async (public_token) => {
    setLoading(true);
    try {
      const response = await fetch('/api/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      const data = await response.json();
      if (data.access_token) {
        localStorage.setItem('plaid_access_token', data.access_token);
        setAccessToken(data.access_token);
      }
    } catch (error) {
      console.error('Error exchanging token:', error);
    }
    setLoading(false);
  };

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const disconnect = () => {
    localStorage.removeItem('plaid_access_token');
    setAccessToken(null);
    setAccounts([]);
    setTransactions([]);
    setTotalBalance(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-6 pb-20 rounded-b-3xl">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold mb-1">My Finances</h1>
          <p className="text-indigo-200 text-sm">Connected with Plaid Sandbox</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 -mt-16">
        {!accessToken ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏦</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Your Bank</h2>
            <p className="text-gray-500 text-sm mb-6">
              Use Plaid sandbox to see test data. No real bank connection needed.
            </p>
            <button
              onClick={() => open()}
              disabled={!ready || loading}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Connecting...' : 'Connect Bank Account'}
            </button>
            <p className="text-xs text-gray-400 mt-4">
              Test credentials: user_good / pass_good
            </p>
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white mb-6">
              <p className="text-indigo-200 text-sm mb-1">Total Balance</p>
              <p className="text-4xl font-bold mb-4">{formatCurrency(totalBalance)}</p>
              <button
                onClick={disconnect}
                className="text-sm text-indigo-200 hover:text-white transition-colors"
              >
                Disconnect Account
              </button>
            </div>

            {/* Accounts */}
            <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
              <h3 className="font-bold text-gray-900 mb-4">Accounts</h3>
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.account_id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-lg">
                          {account.type === 'depository' ? '🏦' : 
                           account.type === 'credit' ? '💳' : '💰'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{account.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{account.subtype}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(account.balances.current)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-2xl shadow-lg p-5">
              <h3 className="font-bold text-gray-900 mb-4">Recent Transactions</h3>
              <div className="space-y-4">
                {transactions.slice(0, 10).map((tx) => (
                  <div
                    key={tx.transaction_id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.amount > 100 ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        <span className="text-lg">{tx.amount > 100 ? '🛒' : '🏠'}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {tx.merchant_name || tx.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(tx.date)}
                          {tx.pending && (
                            <span className="ml-2 text-yellow-600 font-medium">Pending</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold ${tx.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.amount > 0 ? '-' : '+'}
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                ))}
              </div>
              {transactions.length === 0 && (
                <p className="text-gray-500 text-center py-8">No transactions found</p>
              )}
            </div>
          </>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3">
        <div className="max-w-md mx-auto flex justify-around">
          <button className="flex flex-col items-center text-indigo-600">
            <span className="text-xl mb-1">🏠</span>
            <span className="text-xs font-medium">Home</span>
          </button>
          <button className="flex flex-col items-center text-gray-400">
            <span className="text-xl mb-1">📊</span>
            <span className="text-xs">Stats</span>
          </button>
          <button className="flex flex-col items-center text-gray-400">
            <span className="text-xl mb-1">📄</span>
            <span className="text-xs">History</span>
          </button>
          <button className="flex flex-col items-center text-gray-400">
            <span className="text-xl mb-1">⚙️</span>
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
