'use client';

import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  currency: string;
  last_four?: string;
  institution?: { name: string };
  balances?: {
    available: string;
    current: string;
    limit: string | null;
  };
}

interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  date: string;
  description: string;
  type: string;
  status: string;
  merchant?: { name: string };
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/accounts', { method: 'GET' });
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setAccounts(data.accounts || []);
      
      const total = (data.accounts || []).reduce(
        (sum: number, acc: Account) => {
          const balance = parseFloat(acc.balances?.current || '0');
          // For credit accounts, subtract from balance (owed money)
          if (acc.type === 'credit') {
            return sum - Math.abs(balance);
          }
          return sum + balance;
        },
        0
      );
      setTotalBalance(total);
      
      // Fetch transactions for first checking/savings account
      const primaryAccount = (data.accounts || []).find(
        (a: Account) => a.type === 'depository'
      );
      if (primaryAccount) {
        fetchTransactions(primaryAccount.id);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError('Failed to fetch accounts');
    }
    setLoading(false);
  };

  const fetchTransactions = async (accountId: string) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const disconnect = () => {
    setAccounts([]);
    setTransactions([]);
    setTotalBalance(0);
  };

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

  const isConfigured = accounts.length > 0 || error === null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-emerald-600 text-white px-4 py-6 pb-20 rounded-b-3xl">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold mb-1">My Finances</h1>
          <p className="text-emerald-200 text-sm">
            {accounts.length > 0 ? 'Connected with Teller' : 'Teller Integration'}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 -mt-16">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            ⚠️ {error}
            <button 
              onClick={fetchAccounts}
              className="ml-2 underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && accounts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading accounts...</p>
          </div>
        ) : accounts.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏦</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Your Bank</h2>
            <p className="text-gray-500 text-sm mb-6">
              No accounts connected yet.
            </p>
            <button
              onClick={fetchAccounts}
              className="w-full bg-emerald-600 text-white py-3 px-6 rounded-xl font-semibold transition-colors"
            >
              Try Connecting
            </button>
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl shadow-lg p-6 text-white mb-6">
              <p className="text-emerald-200 text-sm mb-1">Total Balance</p>
              <p className="text-4xl font-bold mb-4">{formatCurrency(totalBalance)}</p>
              <button
                onClick={disconnect}
                className="text-sm text-emerald-200 hover:text-white transition-colors"
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
                    key={account.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="text-lg">
                          {account.type === 'depository' ? '🏦' : 
                           account.type === 'credit' ? '💳' : '💰'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{account.name}</p>
                        <p className="text-xs text-gray-500">
                          {account.institution?.name || account.type} • {account.last_four && `••••${account.last_four}`}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold ${account.type === 'credit' ? 'text-red-600' : 'text-gray-900'}`}>
                      {account.type === 'credit' ? '-' : ''}{formatCurrency(parseFloat(account.balances?.current || '0'))}
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
                    key={tx.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.amount > 0 ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        <span className="text-lg">{tx.amount > 0 ? '↑' : '↓'}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {tx.merchant?.name || tx.description || 'Transaction'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(tx.date)}
                          {tx.status === 'pending' && (
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
          <button className="flex flex-col items-center text-emerald-600">
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
