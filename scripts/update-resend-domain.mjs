import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function enableTracking() {
  try {
    // 1. Get all domains
    const { data: domains, error: listError } = await resend.domains.list();
    if (listError) throw listError;
    
    // 2. Find mail.feesplease.app
    const myDomain = domains.data.find(d => d.name === 'mail.feesplease.app');
    
    if (!myDomain) {
      console.log('Domain mail.feesplease.app not found in your account.');
      return;
    }
    
    console.log(`Found domain! ID: ${myDomain.id}. Attempting to enable open/click tracking...`);
    
    // 3. Update the domain to enable tracking
    const { data: updatedDomain, error: updateError } = await resend.domains.update({
      id: myDomain.id,
      openTracking: true,
      clickTracking: true,
    });
    
    if (updateError) throw updateError;
    
    console.log('Success! Tracking has been enabled for mail.feesplease.app via the API.');
    console.log(updatedDomain);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

enableTracking();
