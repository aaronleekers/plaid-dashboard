import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ response: getRuleBasedResponse(message, context), source: 'rules' });
    }

    const systemPrompt = `You are a helpful finance assistant. The user is asking about their personal finances. Here's their current financial data:

ACCOUNTS:
${context.accounts.map((a: any) => `- ${a.name} (${a.institution}): Balance $${a.balance}`).join('\n')}

TOTAL BALANCE: $${context.totalBalance}

SPENDING THIS MONTH: $${context.monthlySpending}
INCOME THIS MONTH: $${context.monthlyIncome}

SUBSCRIPTIONS:
${context.subscriptions.map((s: any) => `- ${s.name}: $${s.amount}/month`).join('\n')}
Total: $${context.subscriptionTotal}

Guidelines:
- Be conversational and helpful
- Answer questions concisely (1-3 sentences)
- If you don't know something, say so`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
      return NextResponse.json({ response: getRuleBasedResponse(message, context), source: 'rules' });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim() || getRuleBasedResponse(message, context);

    return NextResponse.json({ response: aiResponse, source: 'ai' });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ response: 'Sorry, I encountered an error.', source: 'error' }, { status: 500 });
  }
}

function getRuleBasedResponse(message: string, context: any): string {
  const m = message.toLowerCase();
  
  if (m.includes('how much') && (m.includes('spend') || m.includes('spent'))) {
    return `You've spent $${context.monthlySpending.toFixed(2)} this month.`;
  }
  if (m.includes('balance')) {
    return `Your total balance is $${context.totalBalance.toFixed(2)}.`;
  }
  if (m.includes('subscription')) {
    return `You have ${context.subscriptions.length} subscriptions totaling $${context.subscriptionTotal.toFixed(2)} per month.`;
  }
  if (m.includes('income') || m.includes('make') || m.includes('earned')) {
    return `You've received $${context.monthlyIncome.toFixed(2)} in income this month.`;
  }
  if (m.includes('account')) {
    return `You have ${context.accounts.length} connected accounts.`;
  }
  
  return `You have a balance of $${context.totalBalance.toFixed(2)}, spent $${context.monthlySpending.toFixed(2)} this month, and have ${context.subscriptions.length} subscriptions.`;
}
