// Customer notifications beyond email: text messages through Twilio, and push
// notifications (Web Push for browsers, Firebase Cloud Messaging for the
// Android app). Every booking email to a customer can carry a `notify` with
// the phone and account to reach; this sends the short forms of that email.

import { createHash, createSign } from 'node:crypto';
import webpush from 'web-push';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// The Twilio account Lyrshop already has (secret TWILIO_SECRET, default lyrshop/twilio)
let twilioCredentials;
export async function twilioAccount() {
  twilioCredentials ??= JSON.parse((await new SecretsManagerClient({}).send(new GetSecretValueCommand({
    SecretId: process.env.TWILIO_SECRET || 'lyrshop/twilio',
  }))).SecretString);
  return twilioCredentials;
}

// Texts go out from TWILIO_MESSAGING_SERVICE_SID, or else the number TWILIO_SMS_FROM; SMS_ENABLED=false stops them
export const smsEnabled = () => process.env.SMS_ENABLED !== 'false' && !!(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_SMS_FROM);
const SMS_MAX = 320;  // two segments

// US/Canada carriers block texts from numbers without A2P 10DLC registration (Twilio error 30034),
// so +1 numbers wait for SMS_US_ENABLED=true once the Twilio number is registered
const smsAllowedTo = to => !to.startsWith('+1') || process.env.SMS_US_ENABLED === 'true';

export async function sendSms(to, body) {
  if (!smsEnabled() || !/^\+[1-9]\d{7,14}$/.test(String(to ?? '')) || !smsAllowedTo(to)) return false;
  const { account_sid: sid, auth_token: token } = await twilioAccount();
  const form = { To: to, Body: body.length > SMS_MAX ? `${body.slice(0, SMS_MAX - 1)}…` : body };
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.MessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  else form.From = process.env.TWILIO_SMS_FROM;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return true;
    const err = await res.json().catch(() => ({}));
    console.error('SMS failed:', `${to.slice(0, 4)}…`, err.code, err.message);
  } catch (err) {
    console.error('SMS failed:', `${to.slice(0, 4)}…`, err.message);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Push: one document per device in `push_subscriptions`, linked to the
// signed-in account (sub) and its email.
// ---------------------------------------------------------------------------

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';
const webPushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
const fcmEnabled = () => process.env.FCM_ENABLED === 'true';

export const pushConfig = () => ({ vapidPublicKey: webPushEnabled() ? vapidPublicKey() : null, fcm: fcmEnabled(), sms: smsEnabled() });

const subId = key => createHash('sha256').update(key).digest('hex').slice(0, 40);

export async function savePushSubscription(db, { kind, subscription, token, user, userAgent }) {
  const key = kind === 'fcm' ? token : subscription?.endpoint;
  if (!key) throw new Error('Missing push subscription');
  const now = new Date().toISOString();
  await db.collection('push_subscriptions').updateOne({ _id: subId(key) }, {
    $set: { kind, subscription: kind === 'web' ? subscription : null, token: kind === 'fcm' ? token : null,
      sub: user.sub, email: user.email || null, userAgent: String(userAgent ?? '').slice(0, 200), updatedAt: now },
    $setOnInsert: { createdAt: now },
  }, { upsert: true });
  return subId(key);
}

export async function removePushSubscription(db, { kind, subscription, token }) {
  const key = kind === 'fcm' ? token : subscription?.endpoint;
  if (key) await db.collection('push_subscriptions').deleteOne({ _id: subId(key) });
}

// Google OAuth for FCM's HTTP v1 API, from the service account in secret FCM_SECRET (default lyrtrip/fcm)
let fcmAccount, fcmToken;
async function fcmAccess() {
  fcmAccount ??= JSON.parse((await new SecretsManagerClient({}).send(new GetSecretValueCommand({
    SecretId: process.env.FCM_SECRET || 'lyrtrip/fcm',
  }))).SecretString);
  if (fcmToken && fcmToken.expiresAt > Date.now() + 60_000) return { project: fcmAccount.project_id, token: fcmToken.value };
  const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: fcmAccount.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: fcmAccount.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(fcmAccount.private_key, 'base64url');
  const res = await fetch(fcmAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`FCM sign-in failed: ${data.error_description ?? data.error ?? res.status}`);
  fcmToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return { project: fcmAccount.project_id, token: fcmToken.value };
}

// Resolves to 'sent', 'gone' (the device unsubscribed; drop it) or 'failed'
async function pushOne(s, message) {
  if (s.kind === 'web') {
    if (!webPushEnabled()) return 'failed';
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(message), {
        TTL: 86400,
        vapidDetails: { subject: 'mailto:support@lyrtrip.com', publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
      });
      return 'sent';
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) return 'gone';
      console.error('Web push failed:', err.statusCode, err.body ?? err.message);
      return 'failed';
    }
  }
  if (s.kind === 'fcm' && fcmEnabled()) {
    try {
      const { project, token } = await fcmAccess();
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message: {
          token: s.token,
          notification: { title: message.title, body: message.body },
          data: { url: message.url ?? '' },
          android: { priority: 'high', notification: { channel_id: 'bookings' } },
        } }),
      });
      if (res.ok) return 'sent';
      const err = await res.json().catch(() => ({}));
      if (res.status === 404 || err.error?.details?.some(d => d.errorCode === 'UNREGISTERED')) return 'gone';
      console.error('FCM push failed:', res.status, err.error?.message);
    } catch (err) {
      console.error('FCM push failed:', err.message);
    }
  }
  return 'failed';
}

export async function sendPush(db, { sub, email }, message) {
  const or = [sub && { sub }, email && { email: String(email).toLowerCase() }].filter(Boolean);
  if (!or.length) return 0;
  const coll = db.collection('push_subscriptions');
  const subs = await coll.find({ $or: or }).limit(20).toArray();
  const results = await Promise.all(subs.map(s => pushOne(s, message)));
  const gone = subs.filter((_, i) => results[i] === 'gone').map(s => s._id);
  if (gone.length) await coll.deleteMany({ _id: { $in: gone } });
  return results.filter(r => r === 'sent').length;
}

// One status update: a text to the booking's phone and a push to the customer's devices,
// each unless the account switched it off (accounts.notify.sms / .push = false).
export async function notifyCustomer(db, { phone, sub, email, title, body, url }) {
  const prefs = sub ? (await db.collection('accounts').findOne({ _id: sub }, { projection: { notify: 1 } }))?.notify ?? {} : {};
  const [texted, pushed] = await Promise.all([
    phone && prefs.sms !== false ? sendSms(phone, `Lyrtrip: ${title}${url ? ` ${url}` : ''}\nReply STOP to opt out.`) : false,
    prefs.push !== false ? sendPush(db, { sub, email }, { title, body: body ?? title, url: url ?? null }) : 0,
  ]);
  return { texted, pushed };
}
