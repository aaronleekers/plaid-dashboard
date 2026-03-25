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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type TabType = 'home' | 'activity' | 'cards' | 'chat' | 'settings';

const SUBSCRIPTION_TEMPLATES = [
  { name: 'Netflix', icon: 'N', color: '#E50914', category: 'Entertainment' },
  { name: 'Spotify', icon: 'S', color: '#1DB954', category: 'Entertainment' },
  { name: 'Apple Music', icon: 'A', color: '#FC3C44', category: 'Entertainment' },
  { name: 'YouTube Premium', icon: 'Y', color: '#FF0000', category: 'Entertainment' },
  { name: 'Disney+', icon: 'D', color: '#113CCF', category: 'Entertainment' },
  { name: 'HBO Max', icon: 'H', color: '#5822B4', category: 'Entertainment' },
  { name: 'Amazon Prime', icon: 'A', color: '#FF9900', category: 'Shopping' },
  { name: 'iCloud+', icon: 'i', color: '#3395FF', category: 'Storage' },
  { name: 'Google One', icon: 'G', color: '#4285F4', category: 'Storage' },
  { name: 'Planet Fitness', icon: 'P', color: '#5E2B97', category: 'Health' },
  { name: 'Headspace', icon: 'H', color: '#F47D31', category: 'Wellness' },
  { name: 'ChatGPT Plus', icon: 'C', color: '#10A37F', category: 'AI' },
  { name: 'DoorDash', icon: 'D', color: '#FF3008', category: 'Food' },
  { name: 'Uber Eats', icon: 'U', color: '#06C167', category: 'Food' },
];

// Auto-detected from bank transactions - will be populated on load
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(DEFAULT_SUBSCRIPTIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [spending, setSpending] = useState<SpendingCategory[]>([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [income, setIncome] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! Ask me anything about your finances!', timestamp: new Date() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubAmount, setNewSubAmount] = useState('');
  const [newSubDate, setNewSubDate] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestText, setRequestText] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  const monthlySubscriptionTotal = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);

  // Detect subscriptions from transactions
  const detectSubscriptions = (txs: Transaction[]) => {
  const detectSubscriptions = (txs: Transaction[]) => {
    const detected: Subscription[] = [];
    const amountMap: Record<string, Transaction[]> = {};
    
    // Group transactions by similar amount (within $0.50) and merchant
    txs.forEach(tx => {
      const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
      if (amount > 0) {
        const key = `${tx.merchant?.name || tx.description?.slice(0, 20)}-${Math.round(amount * 2) / 2}`;
        if (!amountMap[key]) amountMap[key] = [];
        amountMap[key].push(tx);
      }
    });
    
    // Find recurring charges (same amount 2+ times)
    Object.entries(amountMap).forEach(([key, matches]) => {
      if (matches.length >= 2) {
        const tx = matches[0];
        const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
        const name = tx.merchant?.name || tx.description?.slice(0, 15) || 'Subscription';
        
        // Skip small/one-time charges
        if (amount < 1) return;
        
        const templates = SUBSCRIPTION_TEMPLATES.find(t => 
          name.toLowerCase().includes(t.name.toLowerCase()) ||
          t.name.toLowerCase().includes(name.toLowerCase())
        );
        
        detected.push({
          id: `detected-${key}`,
          name: templates?.name || name,
          amount,
          category: templates?.category || 'Other',
          nextDate: matches[0].date,
          icon: templates?.icon || name.charAt(0).toUpperCase(),
          color: templates?.color || '#666666'
        });
      }
    });
    
    return detected.slice(0, 10);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const response = await fetch('/api/accounts', { method: 'GET' });
      const data = await response.json();
      if (data.error) { setError(data.error); return; }
      setAccounts(data.accounts || []);
      let balance = 0;
      (data.accounts || []).forEach((acc: Account) => {
        const ledger = parseFloat(acc.balances?.ledger || acc.balances?.current || '0') || 0;
        if (acc.type === 'credit') balance -= Math.abs(ledger);
        else balance += ledger;
      });
      setTotalBalance(balance);
      const primaryAccount = (data.accounts || []).find((a: Account) => a.type === 'depository');
      if (primaryAccount) {
        const txResponse = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: primaryAccount.id }),
        });
        const txData = await txResponse.json();
        const allTransactions = txData.transactions || [];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentTx = allTransactions.filter((tx: Transaction) => new Date(tx.date) >= thirtyDaysAgo);
        setTransactions(recentTx.length > 0 ? recentTx : allTransactions.slice(0, 30));
        const spendingMap: Record<string, number> = {};
        let monthSpending = 0, monthIncome = 0;
        (recentTx.length > 0 ? recentTx : allTransactions).forEach((tx: Transaction) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
          if (amount > 0) { monthSpending += amount; const cat = tx.category?.[0] || 'Other'; spendingMap[cat] = (spendingMap[cat] || 0) + amount; }
          else monthIncome += Math.abs(amount);
        });
        setTotalSpending(monthSpending);
        setIncome(monthIncome);
        const spendingData = Object.entries(spendingMap).map(([category, amount]) => ({ category, amount, percentage: (amount / monthSpending) * 100 })).sort((a, b) => b.amount - a.amount).slice(0, 5);
        setSpending(spendingData);
        
        // Auto-detect subscriptions from transactions
        const detectedSubs = detectSubscriptions(recentTx.length > 0 ? recentTx : allTransactions);
        if (detectedSubs.length > 0) {
          setSubscriptions(detectedSubs);
        }
      }
    } catch (err) { console.error('Error:', err); setError('Failed to load data'); }
    setLoading(false);
    setRefreshing(false);
  };

  const addSubscription = (template: typeof SUBSCRIPTION_TEMPLATES[0]) => {
    if (!newSubAmount || !newSubDate) return;
    const newSub: Subscription = { id: Date.now().toString(), name: template.name, amount: parseFloat(newSubAmount), category: template.category, nextDate: newSubDate, icon: template.icon, color: template.color };
    setSubscriptions([...subscriptions, newSub]);
    setShowAddSub(false);
    setNewSubAmount('');
    setNewSubDate('');
  };

  const removeSubscription = (id: string) => setSubscriptions(subscriptions.filter(s => s.id !== id));

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim(), timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);
    try {
      const context = {
        accounts: accounts.map(a => ({ name: a.name, balance: a.balances?.ledger || a.balances?.current, institution: a.institution?.name })),
        totalBalance, monthlySpending: totalSpending, monthlyIncome: income,
        recentTransactions: transactions.slice(0, 20).map(t => ({ description: t.description, merchant: t.merchant?.name, amount: t.amount, date: t.date, category: t.category })),
        subscriptions: subscriptions.map(s => ({ name: s.name, amount: s.amount })),
        subscriptionTotal: monthlySubscriptionTotal
      };
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput.trim(), context }),
      });
      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Sorry, I had trouble answering that.', timestamp: new Date() }]);
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting to the AI.', timestamp: new Date() }]);
    }
    setChatLoading(false);
  };

  const sendFeatureRequest = () => {
    if (!requestText.trim()) return;
    console.log('Feature request from Aaron:', requestText);
    setRequestSent(true);
    setRequestText('');
    setTimeout(() => { setRequestSent(false); setShowRequestModal(false); }, 3000);
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

  const categoryColors: Record<string, { bg: string; text: string }> = {
    'Food and Drink': { bg: 'bg-amber-100', text: 'text-amber-600' },
    'Shopping': { bg: 'bg-pink-100', text: 'text-pink-600' },
    'Entertainment': { bg: 'bg-purple-100', text: 'text-purple-600' },
    'Other': { bg: 'bg-gray-100', text: 'text-gray-600' },
  };

  const renderTabContent = () => {
    if (activeTab === 'activity') return (
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
                    <span className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>{isIncome ? '↓' : '↑'}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{tx.merchant?.name || tx.description?.slice(0, 30) || 'Transaction'}</p>
                    <p className="text-xs text-gray-500">{formatDate(tx.date)} {tx.status === 'pending' && '• Pending'}</p>
                  </div>
                </div>
                <span className={`font-semibold ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>{isIncome ? '+' : '-'}{formatCurrency(amount)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );

    if (activeTab === 'cards') return (
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white">
          <p className="text-slate-400 text-sm mb-1">Monthly Subscriptions</p>
          <p className="text-3xl font-bold mb-1">{formatCurrency(monthlySubscriptionTotal)}</p>
          <p className="text-slate-400 text-sm">{subscriptions.length} active</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">All Subscriptions</h3>
            <button onClick={() => setShowAddSub(true)} className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">+ Add</button>
          </div>
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: sub.color }}>{sub.icon}</div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{sub.name}</p>
                    <p className="text-xs text-gray-500">{sub.category} • {formatDate(sub.nextDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{formatCurrency(sub.amount)}</span>
                  <button onClick={() => removeSubscription(sub.id)} className="text-red-400 hover:text-red-600 p-1 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    if (activeTab === 'chat') return (
      <div className="flex flex-col h-full">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-gray-900">Finance Assistant</h2>
          <p className="text-sm text-gray-500">Ask about your finances</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white text-gray-900 shadow-sm rounded-bl-md'}`}>
                <p className="text-sm">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-emerald-200' : 'text-gray-400'}`}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="flex gap-2">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} placeholder="Ask about your finances..." className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading} className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white disabled:opacity-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      </div>
    );

    if (activeTab === 'settings') return (
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full flex items-center justify-center text-white text-xl font-bold">A</div>
            <div><p className="font-semibold text-gray-900">Aaron Leek</p><p className="text-sm text-gray-500">Connected via Teller</p></div>
          </div>
        </div>
        <button onClick={() => setShowRequestModal(true)} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3"><span className="text-xl">🚀</span><span className="font-semibold">Request an Update</span></div>
          <span className="text-sm opacity-75">Tell me what to build →</span>
        </button>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Connected Accounts</h3>
          <div className="space-y-3">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-lg">🏦</div>
                  <div><p className="font-medium text-gray-900 text-sm">{acc.institution?.name}</p><p className="text-xs text-gray-500">••••{acc.last_four}</p></div>
                </div>
                <span className="text-xs text-emerald-600 font-medium">Connected</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => fetchData(true)} className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <span className="text-gray-700">Refresh Data</span>
          <span className={refreshing ? 'animate-spin text-emerald-600' : 'text-gray-400'}>↻</span>
        </button>
      </div>
    );

    // Home Tab
    return (
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900">This Month</h3><span className="text-xs text-gray-500">Last 30 days</span></div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-red-50 rounded-xl"><p className="text-xs text-red-600 mb-1">Spent</p><p className="text-xl font-bold text-red-600">{formatCurrency(totalSpending)}</p></div>
            <div className="p-4 bg-emerald-50 rounded-xl"><p className="text-xs text-emerald-600 mb-1">Income</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(income)}</p></div>
          </div>
          {spending.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Top Categories</h4>
              {spending.slice(0, 4).map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-700">{cat.category}</span><span className="font-medium text-gray-900">{formatCurrency(cat.amount)}</span></div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cat.percentage}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900">Accounts</h3><span className="text-xs text-gray-500">{accounts.length} connected</span></div>
          <div className="space-y-3">
            {accounts.map((acc) => {
              const balance = parseFloat(acc.balances?.ledger || acc.balances?.current || '0') || 0;
              const isCredit = acc.type === 'credit';
              return (
                <div key={acc.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCredit ? 'bg-slate-100' : 'bg-emerald-100'}`}><span className="text-lg">{isCredit ? '💳' : '🏦'}</span></div>
                    <div><p className="font-medium text-gray-900 text-sm">{acc.name}</p><p className="text-xs text-gray-500">{acc.institution?.name} ••••{acc.last_four}</p></div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isCredit ? 'text-red-500' : 'text-gray-900'}`}>{isCredit ? '-' : ''}{formatCurrency(balance)}</p>
                    {parseFloat(acc.balances?.available || '0') > 0 && <p className="text-xs text-gray-500">{formatCurrency(parseFloat(acc.balances?.available || '0'))} avail</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900">Subscriptions</h3><button onClick={() => setActiveTab('cards')} className="text-sm text-emerald-600 font-medium">See all</button></div>
          <div className="space-y-3">
            {subscriptions.slice(0, 3).map((sub) => (
              <div key={sub.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: sub.color }}>{sub.icon}</div>
                  <div><p className="font-medium text-gray-900 text-sm">{sub.name}</p><p className="text-xs text-gray-500">Next: {formatDate(sub.nextDate)}</p></div>
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-5 pt-14 pb-20">
        <div className="flex items-center justify-between mb-6">
          <div><p className="text-gray-400 text-sm">{getGreeting()}</p><h1 className="text-2xl font-bold text-white">Finance</h1></div>
          <button onClick={() => fetchData(true)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
            <svg className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
        {accounts.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Total Balance</p>
            <p className={`text-4xl font-bold mb-4 ${totalBalance < 0 ? 'text-red-400' : 'text-white'}`}>{totalBalance < 0 ? '-' : ''}{formatCurrency(totalBalance)}</p>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">{accounts.length} Accounts</span>
              {monthlySubscriptionTotal > 0 && <span className="px-2 py-1 bg-white/10 text-gray-300 text-xs rounded-full">{formatCurrency(monthlySubscriptionTotal)}/mo</span>}
            </div>
          </div>
        )}
      </div>

      <div className="-mt-10 flex-1 pb-24">{loading ? <div className="mx-4 bg-white rounded-2xl p-8 shadow-sm text-center"><div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500">Loading...</p></div> : renderTabContent()}</div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-50">
        <div className="max-w-md mx-auto flex justify-around">
          {[
            { icon: '🏠', label: 'Home', tab: 'home' as TabType },
            { icon: '📊', label: 'Activity', tab: 'activity' as TabType },
            { icon: '💳', label: 'Cards', tab: 'cards' as TabType },
            { icon: '💬', label: 'Assistant', tab: 'chat' as TabType },
            { icon: '⚙️', label: 'Settings', tab: 'settings' as TabType },
          ].map(({ icon, label, tab }) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={classNames('flex flex-col items-center py-2 px-3 rounded-xl transition-all min-w-[60px]', activeTab === tab ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400')}>
              <span className="text-xl mb-0.5">{icon}</span>
              <span className={classNames('text-xs', activeTab === tab && 'font-semibold')}>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Add Subscription Modal */}
      {showAddSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowAddSub(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-8" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Subscription</h3>
            <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto mb-4">
              {SUBSCRIPTION_TEMPLATES.map((template) => (
                <button key={template.name} onClick={() => addSubscription(template)} className="p-3 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center">
                  <div className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: template.color as string }}>{template.icon}</div>
                  <p className="text-xs font-medium text-gray-900">{template.name}</p>
                </button>
              ))}
            </div>
            <div className="space-y-3 mb-4">
              <input type="number" placeholder="Amount ($)" value={newSubAmount} onChange={e => setNewSubAmount(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="date" value={newSubDate} onChange={e => setNewSubDate(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={() => { if (newSubAmount && newSubDate) addSubscription({ name: 'Custom', icon: 'C', color: '#666', category: 'Other' }); }} disabled={!newSubAmount || !newSubDate} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">Add Custom</button>
          </div>
        </div>
      )}

      {/* Request Update Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRequestModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            {requestSent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">✅</span></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sent!</h3>
                <p className="text-gray-500 text-sm">Gerald will get right on it.</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Request an Update</h3>
                <p className="text-gray-500 text-sm mb-4">Tell Gerald what you want him to build or fix.</p>
                <textarea value={requestText} onChange={e => setRequestText(e.target.value)} placeholder="I want you to..." className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 h-32 resize-none mb-4" />
                <button onClick={sendFeatureRequest} disabled={!requestText.trim()} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">Send to Gerald</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
