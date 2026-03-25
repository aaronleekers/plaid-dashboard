import { NextRequest, NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ response: 'AI not configured', source: 'rules' });
    }

    const systemPrompt = 'You are a helpful finance assistant. Answer concisely.';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
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
      return NextResponse.json({ response: 'AI error', source: 'error' });
    }

    const data = await response.json();
    const aiResponse = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content.trim() : 'No response';

    return NextResponse.json({ response: aiResponse, source: 'ai' });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ response: 'Error occurred', source: 'error' }, { status: 500 });
  }
}
