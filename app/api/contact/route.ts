import { NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { enquiry, email, mobile, description } = body;

    if (!enquiry || !email || !mobile || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    const domain = process.env.CONFLUENCE_DOMAIN;
    const user = process.env.CONFLUENCE_USER_EMAIL;
    const token = process.env.CONFLUENCE_API_TOKEN;
    // For the general marketing contact page, we route to service desk 34 and request type 34
    const serviceDeskId = '34';
    const requestTypeId = '34';

    if (!domain || !user || !token) {
      console.error('Missing JSM configuration environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    const auth = Buffer.from(`${user}:${token}`).toString('base64');

    // Build the request payload
    const summary = `${enquiry} - from ${email}`;
    const fullDescription = `Enquiry Type: ${enquiry}\nReporter Email: ${email}\nMobile: ${mobile}\n\nDescription:\n${description}`;

    const payload: any = {
      serviceDeskId,
      requestTypeId,
      raiseOnBehalfOf: email,
      requestFieldValues: {
        summary,
        description: fullDescription,
        customfield_10171: mobile // Map mobile to JSM custom field ID
      }
    };

    // Call JSM API to create customer request
    let response = await fetch(`https://${domain}/rest/servicedeskapi/request`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let data = await response.json();

    // Self-healing fallback: If customfield_10171 is not on the JSM request form screen, retry without it
    if (!response.ok && data.errorMessage && (data.errorMessage.includes('customfield_10171') || JSON.stringify(data).includes('customfield_10171'))) {
      console.warn('customfield_10171 is not valid for this request type in JSM. Retrying without it...');
      const fallbackPayload: any = {
        serviceDeskId,
        requestTypeId,
        raiseOnBehalfOf: email,
        requestFieldValues: {
          summary,
          description: fullDescription
        }
      };

      response = await fetch(`https://${domain}/rest/servicedeskapi/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(fallbackPayload)
      });
      data = await response.json();
    }

    if (!response.ok) {
      console.error('Jira Service Desk API Error:', data);
      return NextResponse.json(
        { error: data.errorMessage || 'Failed to submit enquiry to Jira' },
        {
          status: response.status,
          headers: { 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    return NextResponse.json(
      { success: true, issueKey: data.issueKey },
      {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  } catch (err: any) {
    console.error('Contact API proxy route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}
