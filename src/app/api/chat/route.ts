import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      // Fallback to rule-based responses
      const response = getRuleBasedResponse(message, context);
      return NextResponse.json({ response, source: 'rules' });
    }

    // Build system prompt with user's financial context
    const systemPrompt = `You are a helpful finance assistant. The user is asking about their personal finances. Here's their current financial data:

ACCOUNTS:
${context.accounts.map((a: any) => `- ${a.name} (${a.institution}): Balance $${a.balance}`).join('\n')}

TOTAL BALANCE: $${context.totalBalance}

SPENDING THIS MONTH: $${context.monthlySpending}
INCOME THIS MONTH: $${context.monthlyIncome}

RECENT TRANSACTIONS:
${context.recentTransactions.map((t: any) => `- ${t.merchant || t.description}: $${t.amount} (${t.category}) - ${t.date}`).join('\n')}

SUBSCRIPTIONS (${context.subscriptions.length}):
${context.subscriptions.map((s: any) => `- ${s.name}: $${s.amount}/month`).join('\n')}
Total monthly subscriptions: $${context.subscriptionTotal}

Guidelines:
- Be conversational and helpful
- Answer questions about their spending, accounts, and finances
- Provide insights when relevant
- Keep responses concise (1-3 sentences)
- If you don't know something, say so
- Don't make up specific transaction details`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://plaid-dashboard-delta.vercel.app',
        'X-Title': 'Finance Assistant'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter error:', response.status, errorData);
      return NextResponse.json({ 
        response: getRuleBasedResponse(message, context),
        source: 'rules',
        error: 'AI API error'
      });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim() || getRuleBasedResponse(message, context);

    return NextResponse.json({ response: aiResponse, source: 'ai' });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ 
      response: 'Sorry, I encountered an error. Please try again.',
      source: 'error'
    }, { status: 500 });
  }
}

function getRuleBasedResponse(message: string, context: any): string {
  const m = message.toLowerCase();
  
  if (m.includes('how much') && (m.includes('spend') || m.includes('spent'))) {
    return `You've spent $${context.monthlySpending.toFixed(2)} this month.`;
  }
  
  if (m.includes('balance')) {
    return `Your total balance across all accounts is $${context.totalBalance.toFixed(2)}.`;
  }
  
  if (m.includes('subscription')) {
    return `You have ${context.subscriptions.length} subscriptions totaling $${context.subscriptionTotal.toFixed(2)} per month.`;
  }
  
  if (m.includes('income') || m.includes('make') || m.includes('earned')) {
    return `You've received $${context.monthlyIncome.toFixed(2)} in income this month.`;
  }
  
  if (m.includes('transaction') || m.includes('last')) {
    return `You have ${context.recentTransactions.length} recent transactions. Your most recent one was "${context.recentTransactions[0]?.merchant || context.recentTransactions[0]?.description}" for $${context.recentTransactions[0]?.amount}.`;
  }
  
  if (m.includes('account')) {
    return `You have ${context.accounts.length} connected accounts: ${context.accounts.map((a: any) => a.name).join(', ')}.`;
  }
  
  return `Based on your data, you have a total balance of $${context.totalBalance.toFixed(2)}, have spent $${context.monthlySpending.toFixed(2)} this month, and have ${context.subscriptions.length} active subscriptions. What would you like to know more about?`;
}
