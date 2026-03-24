import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const appId = process.env.TELLER_APP_ID;
    const secret = process.env.TELLER_SECRET;

    if (!appId || !secret) {
      return NextResponse.json({ 
        error: 'Teller credentials not configured',
        hint: 'Set TELLER_APP_ID and TELLER_SECRET environment variables'
      }, { status: 500 });
    }

    // Create an enrollment to get a connect URL
    const response = await fetch('https://api.teller.io/enrollments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${appId}:${secret}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        enrollment_type: 'bank',
        return_url: process.env.NEXT_PUBLIC_APP_URL + '/?connected=true',
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Teller enrollment error:', data);
      return NextResponse.json({ error: data.message || 'Failed to create enrollment' }, { status: 500 });
    }

    return NextResponse.json({ 
      enrollment_id: data.id,
      url: data.url 
    });
  } catch (error) {
    console.error('Error creating enrollment:', error);
    return NextResponse.json({ error: 'Failed to connect bank' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const appId = process.env.TELLER_APP_ID;
    const secret = process.env.TELLER_SECRET;

    if (!appId || !secret) {
      return NextResponse.json({ error: 'Teller credentials not configured' }, { status: 500 });
    }

    // Get existing enrollments
    const response = await fetch('https://api.teller.io/enrollments', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${appId}:${secret}`).toString('base64'),
      },
    });

    const enrollments = await response.json();
    return NextResponse.json({ enrollments });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}
