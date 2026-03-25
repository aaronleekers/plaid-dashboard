'use client';

import React, { useState, useEffect, useRef } from 'react';

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

interface SpendingCategory {
  category: string;
  amount: number;
  color: { bg: string; text: string; light: string };
  icon: string;
}

const COLORS: SpendingCategory['color'][] = [
  { bg: 'bg-gradient-to-br from-emerald-400 to-teal-500', text: 'text-emerald-500', light: 'bg-emerald-100' },
  { bg: 'bg-gradient-to-br from-blue-400 to-indigo-500', text: 'text-blue-500', light: 'bg-blue-100' },
  { bg: 'bg-gradient-to-br from-purple-400 to-pink-500', text: 'text-purple-500', light: 'bg-purple-100' },
  { bg: 'bg-gradient-to-br from-orange-400 to-red-500', text: 'text-orange-500', light: 'bg-orange-100' },
  { bg: 'bg-gradient-to-br from-cyan-400 to-blue-500', text: 'text-cyan-500', light: 'bg-cyan-100' },
  { bg: 'bg-gradient-to-br from-rose-400 to-pink-500', text: 'text-rose-500', light: 'bg-rose-100' },
];

const CATEGORY_ICONS: Record<string, string> = {
  'Food and Drink': '🍽️',
  'Travel': '✈️',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Healthcare': '🏥',
  'Utilities': '💡',
  'Transportation': '🚗',
  'Other': '📦',
};

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [spending, setSpending] = useState<SpendingCategory[]>([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [income, setIncome] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const transactionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      
      const response = await fetch('/api/accounts', { method: 'GET' });
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setAccounts(data.accounts || []);
      
      // Calculate totals
      let balance = 0;
      let spendingTotal = 0;
      let incomeTotal = 0;
      
      (data.accounts || []).forEach((acc: Account) => {
        const ledger = parseFloat(acc.balances?.ledger || acc.balances?.current || '0') || 0;
        if (acc.type === 'credit') {
          balance -= Math.abs(ledger);
        } else {
          balance += ledger;
        }
      });
      
      setTotalBalance(balance);
      
      // Fetch transactions
      const primaryAccount = (data.accounts || []).find(
        (a: Account) => a.type === 'depository'
      );
      
      if (primaryAccount) {
        const txResponse = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: primaryAccount.id }),
        });
        const txData = await txResponse.json();
        const allTransactions = txData.transactions || [];
        
        // Filter to this month only
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthTx = allTransactions.filter((tx: Transaction) => {
          const txDate = new Date(tx.date);
          return txDate >= startOfMonth;
        });
        
        const displayTransactions = thisMonthTx.length > 0 ? thisMonthTx : allTransactions.slice(0, 20);
        setTransactions(displayTransactions);
        
        // Calculate spending & income for THIS MONTH or last 30 days
        const spendingMap: Record<string, number> = {};
        let monthSpending = 0;
        let monthIncome = 0;
        
        const txsToUse = thisMonthTx.length > 0 ? thisMonthTx : allTransactions.filter((tx: Transaction) => {
          const txDate = new Date(tx.date);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return txDate >= thirtyDaysAgo;
        });
        
        txsToUse.forEach((tx: Transaction) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
          if (amount > 0) {
            monthSpending += amount;
            const category = tx.category?.[0] || 'Other';
            spendingMap[category] = (spendingMap[category] || 0) + amount;
          } else {
            monthIncome += Math.abs(amount);
          }
        });
        
        setTotalSpending(monthSpending);
        setIncome(monthIncome);
        
        // Build spending categories
        const spendingData: SpendingCategory[] = Object.entries(spendingMap)
          .map(([category, amount], index) => ({
            category,
            amount,
            color: COLORS[index % COLORS.length],
            icon: CATEGORY_ICONS[category] || '📦',
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);
        
        setSpending(spendingData);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load data');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleRefresh = () => fetchData(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const netAssets = totalBalance;
  const netAssetsClass = netAssets >= 0 ? 'text-white' : 'text-red-200';

  // Calculate donut chart segments
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 px-5 pt-12 pb-28 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative max-w-md mx-auto">
          {/* Header row */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-emerald-100 text-sm">{getGreeting()}</p>
              <h1 className="text-2xl font-bold text-white mt-0.5">My Finances</h1>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleRefresh}
                className="w-11 h-11 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition-all active:scale-95"
              >
                <svg className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <span className="text-xl">👤</span>
              </div>
            </div>
          </div>
          
          {/* Balance Card */}
          {accounts.length > 0 && (
            <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
              <p className="text-emerald-100 text-sm mb-1">Total Balance</p>
              <p className={`text-4xl font-bold ${netAssetsClass} mb-1`}>
                {netAssets < 0 ? '-' : ''}{formatCurrency(netAssets)}
              </p>
              <p className="text-emerald-100/80 text-xs">
                {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-5 -mt-20">
        {/* Error State */}
        {error && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <span className="text-gray-700 text-sm">{error}</span>
            </div>
            <button 
              onClick={handleRefresh}
              className="text-emerald-600 font-medium text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
            <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading your finances...</p>
          </div>
        ) : accounts.length === 0 && !error ? (
          /* Empty State */
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg">
              <span className="text-5xl">🏦</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to Your Finance Hub</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
              Connect your bank account to see your balances and transactions in one place.
            </p>
            <button
              onClick={handleRefresh}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 px-8 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              Connect Bank
            </button>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-2xl shadow-md p-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-lg">💸</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpending)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Spent this month</p>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-lg">💰</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(income)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Income this month</p>
              </div>
            </div>

            {/* Spending Breakdown */}
            {spending.length > 0 && (
              <div className="bg-white rounded-3xl shadow-md p-5 mb-4">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-gray-900">Spending Breakdown</h2>
                  <span className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'long' })}</span>
                </div>
                
                {/* Donut Chart */}
                <div className="flex items-center gap-5">
                  <div className="relative w-32 h-32 flex-shrink-0">
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" stroke="#f3f4f6" strokeWidth="14" fill="none" />
                      {spending.map((item, index) => {
                        const percentage = (item.amount / totalSpending) * 100;
                        const dashArray = `${(percentage / 100) * 314.16} 314.16`;
                        const dashOffset = -cumulativePercentage * 3.1416;
                        cumulativePercentage += percentage;
                        return (
                          <circle
                            key={item.category}
                            cx="60"
                            cy="60"
                            r="50"
                            stroke={item.color.bg.includes('from-emerald') ? '#10B981' : 
                                    item.color.bg.includes('from-blue') ? '#3B82F6' :
                                    item.color.bg.includes('from-purple') ? '#8B5CF6' :
                                    item.color.bg.includes('from-orange') ? '#F97316' :
                                    item.color.bg.includes('from-cyan') ? '#06B6D4' : '#EC4899'}
                            strokeWidth="14"
                            fill="none"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-gray-500">Total</span>
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(totalSpending)}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    {spending.map((item) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${item.color.bg} flex items-center justify-center`}>
                            <span className="text-sm">{item.icon}</span>
                          </div>
                          <span className="text-sm text-gray-600">{item.category}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Accounts */}
            <div className="bg-white rounded-3xl shadow-md p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Accounts</h2>
                <span className="text-xs text-gray-500">{accounts.length} total</span>
              </div>
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        account.type === 'depository' 
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                          : 'bg-gradient-to-br from-purple-400 to-pink-500'
                      }`}>
                        <span className="text-xl">{account.type === 'depository' ? '🏦' : '💳'}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{account.name}</p>
                        <p className="text-xs text-gray-500">
                          {account.institution?.name} ••••{account.last_four}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${account.type === 'credit' ? 'text-red-500' : 'text-gray-900'}`}>
                        {account.type === 'credit' ? '-' : ''}{formatCurrency(parseFloat(account.balances?.ledger || '0'))}
                      </p>
                      <p className="text-xs text-gray-500">
                        {parseFloat(account.balances?.available || '0') > 0 && `${formatCurrency(parseFloat(account.balances?.available || '0'))} avail`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-3xl shadow-md p-5" ref={transactionsRef}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Recent Activity</h2>
                <button 
                  onClick={() => setShowTransactions(!showTransactions)}
                  className="text-emerald-600 text-sm font-medium"
                >
                  {showTransactions ? 'Show Less' : 'See All'}
                </button>
              </div>
              
              <div className="space-y-1">
                {(showTransactions ? transactions : transactions.slice(0, 5)).map((tx) => {
                const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 px-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                        amount > 0 
                          ? 'bg-red-100 text-red-500' 
                          : 'bg-emerald-100 text-emerald-500'
                      }`}>
                        <span className="text-lg">{amount > 0 ? '↑' : '↓'}</span>
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
                    <p className={`font-semibold ${amount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {amount > 0 ? '-' : '+'}{formatCurrency(amount)}
                    </p>
                  </div>
                );
              })}
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-md mx-auto flex justify-around">
          {[
            { icon: '🏠', label: 'Home', active: true },
            { icon: '📊', label: 'Activity', active: false },
            { icon: '💳', label: 'Cards', active: false },
            { icon: '⚙️', label: 'Settings', active: false },
          ].map((item, index) => (
            <button 
              key={index}
              className={classNames(
                'flex flex-col items-center py-2 px-4 rounded-2xl transition-all',
                item.active 
                  ? 'text-emerald-600 bg-emerald-50' 
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <span className="text-2xl mb-0.5">{item.icon}</span>
              <span className={classNames(
                'text-xs',
                item.active ? 'font-semibold' : ''
              )}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
