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

interface Subscription {
  id: string;
  name: string;
  amount: number;
  category: string;
  nextDate: string;
  icon: string;
  color: string;
}

interface SpendingCategory {
  category: string;
  amount: number;
  percentage: number;
}

type TabType = 'home' | 'activity' | 'cards' | 'settings';

// Subscriptions data
const SAMPLE_SUBSCRIPTIONS: Subscription[] = [
  { id: '1', name: 'Netflix', amount: 15.99, category: 'Entertainment', nextDate: '2026-03-28', icon: 'N', color: '#E50914' },
  { id: '2', name: 'Spotify', amount: 9.99, category: 'Entertainment', nextDate: '2026-03-25', icon: 'S', color: '#1DB954' },
  { id: '3', name: 'iCloud+', amount: 2.99, category: 'Storage', nextDate: '2026-04-01', icon: 'i', color: '#3395FF' },
  { id: '4', name: 'Planet Fitness', amount: 49.99, category: 'Health', nextDate: '2026-03-30', icon: 'P', color: '#5E2B97' },
  { id: '5', name: 'Amazon Prime', amount: 14.99, category: 'Shopping', nextDate: '2026-04-05', icon: 'A', color: '#FF9900' },
];

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions] = useState<Subscription[]>(SAMPLE_SUBSCRIPTIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [spending, setSpending] = useState<SpendingCategory[]>([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [income, setIncome] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showAllSubs, setShowAllSubs] = useState(false);

  const monthlySubscriptionTotal = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);

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
      (data.accounts || []).forEach((acc: Account) => {
        const ledger = parseFloat(acc.balances?.ledger || acc.balances?.current || '0') || 0;
        if (acc.type === 'credit') balance -= Math.abs(ledger);
        else balance += ledger;
      });
      setTotalBalance(balance);
      
      // Fetch transactions
      const primaryAccount = (data.accounts || []).find((a: Account) => a.type === 'depository');
      if (primaryAccount) {
        const txResponse = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: primaryAccount.id }),
        });
        const txData = await txResponse.json();
        const allTransactions = txData.transactions || [];
        
        // Filter to last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentTx = allTransactions.filter((tx: Transaction) => new Date(tx.date) >= thirtyDaysAgo);
        setTransactions(recentTx.length > 0 ? recentTx : allTransactions.slice(0, 30));
        
        // Calculate spending
        const spendingMap: Record<string, number> = {};
        let monthSpending = 0;
        let monthIncome = 0;
        
        (recentTx.length > 0 ? recentTx : allTransactions).forEach((tx: Transaction) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
          if (amount > 0) {
            monthSpending += amount;
            const cat = tx.category?.[0] || 'Other';
            spendingMap[cat] = (spendingMap[cat] || 0) + amount;
          } else {
            monthIncome += Math.abs(amount);
          }
        });
        
        setTotalSpending(monthSpending);
        setIncome(monthIncome);
        
        const spendingData = Object.entries(spendingMap)
          .map(([category, amount]) => ({ category, amount, percentage: (amount / monthSpending) * 100 }))
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

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Category colors
  const categoryColors: Record<string, { bg: string; text: string }> = {
    'Food and Drink': { bg: 'bg-amber-100', text: 'text-amber-600' },
    'Travel': { bg: 'bg-sky-100', text: 'text-sky-600' },
    'Shopping': { bg: 'bg-pink-100', text: 'text-pink-600' },
    'Entertainment': { bg: 'bg-purple-100', text: 'text-purple-600' },
    'Healthcare': { bg: 'bg-green-100', text: 'text-green-600' },
    'Utilities': { bg: 'bg-blue-100', text: 'text-blue-600' },
    'Transportation': { bg: 'bg-orange-100', text: 'text-orange-600' },
    'Other': { bg: 'bg-gray-100', text: 'text-gray-600' },
  };

  // Render tabs
  const renderTabContent = () => {
    if (activeTab === 'activity') {
      return (
        <div className="px-4 pt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Activity</h2>
          <div className="space-y-2">
            {transactions.map((tx) => {
              const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
              const isIncome = amount < 0;
              return (
                <div key={tx.id} className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncome ? 'bg-emerald-100' : 'bg-red-50'}`}>
                      <span className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isIncome ? '↓' : '↑'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{tx.merchant?.name || tx.description?.slice(0, 30) || 'Transaction'}</p>
                      <p className="text-xs text-gray-500">{formatDate(tx.date)} {tx.status === 'pending' && '• Pending'}</p>
                    </div>
                  </div>
                  <span className={`font-semibold ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeTab === 'cards') {
      const sortedSubs = [...subscriptions].sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());
      const upcomingSubs = sortedSubs.slice(0, 3);
      
      return (
        <div className="px-4 pt-4 space-y-4">
          {/* Monthly Summary */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white">
            <p className="text-slate-400 text-sm mb-1">Monthly Subscriptions</p>
            <p className="text-3xl font-bold mb-1">{formatCurrency(monthlySubscriptionTotal)}</p>
            <p className="text-slate-400 text-sm">{subscriptions.length} active</p>
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Next Payments</h3>
            <div className="space-y-3">
              {upcomingSubs.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: sub.color }}>
                      {sub.icon}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{sub.name}</p>
                      <p className="text-xs text-gray-500">{formatDate(sub.nextDate)}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(sub.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* All Subscriptions */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">All Subscriptions</h3>
              <button className="text-sm text-emerald-600 font-medium">+ Add</button>
            </div>
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: sub.color }}>
                      {sub.icon}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{sub.name}</p>
                      <p className="text-xs text-gray-500">{sub.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(sub.amount)}</p>
                    <p className="text-xs text-gray-500">/mo</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'settings') {
      return (
        <div className="px-4 pt-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Profile</h3>
              <button className="text-sm text-emerald-600 font-medium">Edit</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full flex items-center justify-center text-white text-xl font-bold">
                A
              </div>
              <div>
                <p className="font-semibold text-gray-900">Aaron Leek</p>
                <p className="text-sm text-gray-500">Connected via Teller</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Connected Accounts</h3>
            <div className="space-y-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-lg">🏦</div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{acc.institution?.name}</p>
                      <p className="text-xs text-gray-500">••••{acc.last_four}</p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-600 font-medium">Connected</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Preferences</h3>
            <div className="space-y-3">
              {[
                { icon: '🔔', label: 'Notifications', value: 'On' },
                { icon: '🔒', label: 'Security', value: 'PIN' },
                { icon: '🌐', label: 'Currency', value: 'USD' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span className="text-gray-700">{item.label}</span>
                  </div>
                  <span className="text-gray-500 text-sm">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => fetchData(true)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between"
          >
            <span className="text-gray-700">Refresh Data</span>
            <span className={refreshing ? 'animate-spin text-emerald-600' : 'text-gray-400'}>↻</span>
          </button>
        </div>
      );
    }

    // Home Tab
    return (
      <div className="px-4 pt-4 space-y-4">
        {/* Spending Overview */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">This Month</h3>
            <span className="text-xs text-gray-500">Last 30 days</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-red-50 rounded-xl">
              <p className="text-xs text-red-600 mb-1">Spent</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalSpending)}</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <p className="text-xs text-emerald-600 mb-1">Income</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(income)}</p>
            </div>
          </div>
          
          {spending.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Top Categories</h4>
              {spending.slice(0, 4).map((cat) => {
                const colors = categoryColors[cat.category] || categoryColors['Other'];
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{cat.category}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(cat.amount)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Accounts */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Accounts</h3>
            <span className="text-xs text-gray-500">{accounts.length} connected</span>
          </div>
          <div className="space-y-3">
            {accounts.map((acc) => {
              const balance = parseFloat(acc.balances?.ledger || acc.balances?.current || '0') || 0;
              const isCredit = acc.type === 'credit';
              return (
                <div key={acc.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCredit ? 'bg-slate-100' : 'bg-emerald-100'}`}>
                      <span className="text-lg">{isCredit ? '💳' : '🏦'}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{acc.name}</p>
                      <p className="text-xs text-gray-500">{acc.institution?.name} ••••{acc.last_four}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isCredit ? 'text-red-500' : 'text-gray-900'}`}>
                      {isCredit ? '-' : ''}{formatCurrency(balance)}
                    </p>
                    {parseFloat(acc.balances?.available || '0') > 0 && (
                      <p className="text-xs text-gray-500">{formatCurrency(parseFloat(acc.balances?.available || '0'))} avail</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subscriptions Preview */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Subscriptions</h3>
            <button onClick={() => setActiveTab('cards')} className="text-sm text-emerald-600 font-medium">See all</button>
          </div>
          <div className="space-y-3">
            {subscriptions.slice(0, 3).map((sub) => (
              <div key={sub.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: sub.color }}>
                    {sub.icon}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{sub.name}</p>
                    <p className="text-xs text-gray-500">Next: {formatDate(sub.nextDate)}</p>
                  </div>
                </div>
                <span className="font-semibold text-gray-900">{formatCurrency(sub.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-5 pt-14 pb-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm">{getGreeting()}</p>
            <h1 className="text-2xl font-bold text-white">Finance</h1>
          </div>
          <button 
            onClick={() => fetchData(true)}
            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <svg className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        {/* Balance Card */}
        {accounts.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Total Balance</p>
            <p className={`text-4xl font-bold mb-4 ${totalBalance < 0 ? 'text-red-400' : 'text-white'}`}>
              {totalBalance < 0 ? '-' : ''}{formatCurrency(totalBalance)}
            </p>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">
                {accounts.length} Accounts
              </span>
              {monthlySubscriptionTotal > 0 && (
                <span className="px-2 py-1 bg-white/10 text-gray-300 text-xs rounded-full">
                  {formatCurrency(monthlySubscriptionTotal)}/mo subs
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="-mt-10 pb-24">
        {error && (
          <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={() => fetchData(true)} className="text-red-600 font-medium text-sm">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="mx-4 bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : accounts.length === 0 && !error ? (
          <div className="mx-4 bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏦</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Account</h2>
            <p className="text-gray-500 text-sm mb-4">Link your bank account to get started</p>
            <button onClick={() => fetchData()} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-medium">
              Connect
            </button>
          </div>
        ) : (
          renderTabContent()
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="max-w-md mx-auto flex justify-around">
          {[
            { icon: '🏠', label: 'Home', tab: 'home' as TabType },
            { icon: '📊', label: 'Activity', tab: 'activity' as TabType },
            { icon: '💳', label: 'Cards', tab: 'cards' as TabType },
            { icon: '⚙️', label: 'Settings', tab: 'settings' as TabType },
          ].map(({ icon, label, tab }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={classNames(
                'flex flex-col items-center py-2 px-4 rounded-xl transition-all',
                activeTab === tab 
                  ? 'text-emerald-600 bg-emerald-50' 
                  : 'text-gray-400'
              )}
            >
              <span className="text-xl mb-0.5">{icon}</span>
              <span className={classNames('text-xs', activeTab === tab && 'font-semibold')}>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
