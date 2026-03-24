'use client';

import React, { useState, useEffect } from 'react';

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
    ledger?: string;
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
  category?: string[];
}

interface SpendingByCategory {
  category: string;
  amount: number;
  color: string;
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [spending, setSpending] = useState<SpendingByCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'transactions' | 'stats'>('home');
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
      
      // Calculate total balance
      const total = (data.accounts || []).reduce(
        (sum: number, acc: Account) => {
          const balance = parseFloat(acc.balances?.ledger || acc.balances?.current || '0');
          if (acc.type === 'credit') {
            return sum - Math.abs(balance);
          }
          return sum + balance;
        },
        0
      );
      setTotalBalance(total);
      
      // Fetch transactions for first checking account
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
      
      // Calculate spending by category
      const spendingMap: Record<string, number> = {};
      const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
      
      (data.transactions || [])
        .filter((tx: Transaction) => tx.amount > 0)
        .forEach((tx: Transaction, i: number) => {
          const category = tx.category?.[0] || 'Other';
          spendingMap[category] = (spendingMap[category] || 0) + tx.amount;
        });
      
      const spendingData = Object.entries(spendingMap)
        .map(([category, amount], index) => ({
          category,
          amount,
          color: colors[index % colors.length]
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);
      
      setSpending(spendingData);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getMonthName = () => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const totalSpending = spending.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 px-5 pt-12 pb-24 rounded-b-[2.5rem] shadow-xl">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-emerald-100 text-sm">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</p>
              <h1 className="text-2xl font-bold text-white mt-1">My Finances</h1>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
          </div>
          
          {accounts.length > 0 && (
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6">
              <p className="text-emerald-100 text-sm mb-1">{getMonthName()} Balance</p>
              <p className="text-4xl font-bold text-white mb-1">{formatCurrency(totalBalance)}</p>
              <p className="text-emerald-100/80 text-xs">
                Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-5 -mt-16">
        {error && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <span className="text-gray-700">{error}</span>
            </div>
            <button 
              onClick={fetchAccounts}
              className="text-emerald-600 font-medium text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading your finances...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🏦</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to Your Finance Hub</h2>
            <p className="text-gray-500 text-sm mb-6">
              Connect your bank account to get started with real-time insights.
            </p>
            <button
              onClick={fetchAccounts}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 px-8 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Connect Bank
            </button>
          </div>
        ) : (
          <>
            {/* Spending Overview Card */}
            {spending.length > 0 && (
              <div className="bg-white rounded-3xl shadow-lg p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900">Spending This Month</h2>
                  <span className="text-emerald-600 font-semibold text-sm">{formatCurrency(totalSpending)}</span>
                </div>
                
                {/* Mini Donut Chart */}
                <div className="flex items-center gap-6">
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg className="w-28 h-28 transform -rotate-90">
                      <circle cx="56" cy="56" r="48" stroke="#f3f4f6" strokeWidth="12" fill="none" />
                      {spending.reduce((acc, item, i) => {
                        const percentage = (item.amount / totalSpending) * 100;
                        const dashArray = `${(percentage / 100) * 301.6} 301.6`;
                        const dashOffset = -acc.offset;
                        acc.elements.push(
                          <circle
                            key={item.category}
                            cx="56"
                            cy="56"
                            r="48"
                            stroke={item.color}
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                          />
                        );
                        acc.offset += (percentage / 100) * 301.6;
                        return acc;
                      }, { elements: [] as React.ReactElement[], offset: 0 }).elements}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-gray-500">Spent</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    {spending.slice(0, 4).map((item) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-sm text-gray-600 capitalize">{item.category}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-lg">💳</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    accounts.filter(a => a.type === 'credit')[0]?.balances?.ledger
                      ? parseFloat(accounts.filter(a => a.type === 'credit')[0]?.balances?.ledger || '0')
                      : 0
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Credit Balance</p>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-lg">📊</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
                <p className="text-xs text-gray-500 mt-1">Transactions</p>
              </div>
            </div>

            {/* Accounts List */}
            <div className="bg-white rounded-3xl shadow-lg p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Accounts</h2>
                <button className="text-emerald-600 text-sm font-medium">See All</button>
              </div>
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        account.type === 'depository' 
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-400'
                          : 'bg-gradient-to-br from-purple-400 to-pink-400'
                      }`}>
                        <span className="text-xl">
                          {account.type === 'depository' ? '🏦' : '💳'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{account.name}</p>
                        <p className="text-xs text-gray-500">
                          {account.institution?.name} ••••{account.last_four}
                        </p>
                      </div>
                    </div>
                    <p className={`font-bold ${account.type === 'credit' ? 'text-red-500' : 'text-gray-900'}`}>
                      {account.type === 'credit' ? '-' : ''}{formatCurrency(parseFloat(account.balances?.ledger || account.balances?.current || '0'))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-3xl shadow-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Recent Transactions</h2>
                <button className="text-emerald-600 text-sm font-medium">See All</button>
              </div>
              <div className="space-y-1">
                {transactions.slice(0, 6).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                        tx.amount > 0 
                          ? 'bg-red-100 text-red-500' 
                          : 'bg-emerald-100 text-emerald-500'
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
                            <span className="ml-2 text-yellow-600 font-medium">• Pending</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold ${tx.amount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {tx.amount > 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                ))}
              </div>
              {transactions.length === 0 && (
                <div className="text-center py-8">
                  <span className="text-4xl mb-2 block">📭</span>
                  <p className="text-gray-500">No transactions yet</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-md mx-auto flex justify-around">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center py-2 px-4 rounded-2xl transition-all ${
              activeTab === 'home' 
                ? 'text-emerald-600 bg-emerald-50' 
                : 'text-gray-400'
            }`}
          >
            <span className="text-2xl mb-1">🏠</span>
            <span className={`text-xs ${activeTab === 'home' ? 'font-semibold' : ''}`}>Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`flex flex-col items-center py-2 px-4 rounded-2xl transition-all ${
              activeTab === 'transactions' 
                ? 'text-emerald-600 bg-emerald-50' 
                : 'text-gray-400'
            }`}
          >
            <span className="text-2xl mb-1">📊</span>
            <span className={`text-xs ${activeTab === 'transactions' ? 'font-semibold' : ''}`}>Activity</span>
          </button>
          <button className="flex flex-col items-center py-2 px-4 text-gray-400">
            <span className="text-2xl mb-1">📄</span>
            <span className="text-xs">Cards</span>
          </button>
          <button className="flex flex-col items-center py-2 px-4 text-gray-400">
            <span className="text-2xl mb-1">⚙️</span>
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
