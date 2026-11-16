/**
 * TITAN OS V6.0.33 — GMAIL TRANSPORT
 * Module: gmail.js
 * Purpose: Headless outbound email dispatch via OAuth2 REST API
 */

/**
 * Automatically fetches a fresh, short-lived access token from Google
 * using the long-lived refresh token stored in Render environment variables.
 */
async function refreshGmailToken(config) {
  const url = 'https://oauth2.googleapis.com/token';
  const payload = {
    client_id: config.gmail.clientId,
    client_secret: config.gmail.clientSecret,
    refresh_token: config.gmail.refreshToken,
    grant_type: 'refresh_token'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail token refresh failed (${res.status}): ${errText}`);
    }
    
    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error('[Gmail Transport] Auth Error:', err.message);
    return null;
  }
}

/**
 * Constructs a MIME-compliant email and dispatches it via the Gmail REST API.
 */
async function sendOutboundEmail(config, toEmail, subject, bodyText) {
  if (!config.gmail.clientId || !config.gmail.refreshToken) {
    console.warn('[Gmail Transport] Missing OAuth credentials in configuration. Aborting dispatch.');
    return false;
  }

  const accessToken = await refreshGmailToken(config);
  if (!accessToken) {
    console.error('[Gmail Transport] Failed to retrieve valid access token. Aborting dispatch.');
    return false;
  }

  // Construct standard MIME message with UTF-8 encoding support for special characters
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `To: ${toEmail}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText
  ];

  // The Gmail API requires a base64url encoded string
  const rawMessage = Buffer.from(messageParts.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawMessage })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Gmail Transport] Dispatch API rejected payload (${res.status}):`, err);
      return false;
    }
    
    console.log(`[Gmail Transport] Successfully dispatched email to: ${toEmail}`);
    return true;
  } catch (err) {
    console.error('[Gmail Transport] Network/API Exception during dispatch:', err.message);
    return false;
  }
}

module.exports = {
  sendOutboundEmail
};
