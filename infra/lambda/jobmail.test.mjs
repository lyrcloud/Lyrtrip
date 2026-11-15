// node --test infra/lambda/jobmail.test.mjs — the job-application mail relay's parsing and message building
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simpleParser } from 'mailparser';
import { jobMailInternals as j } from './search.mjs';

test('finds the address a listing asks applicants to write to, skipping privacy and no-reply ones', () => {
  const found = j.employerEmailsIn('Questions? privacy@acme.com. Send your CV to Careers@Acme.com or talk to bob@acme.com.', [{ items: ['noreply@acme.com'] }]);
  assert.deepEqual(found, ['careers@acme.com', 'bob@acme.com']);
  assert.deepEqual(j.employerEmailsIn('Apply on our website', []), []);
});

test('reply addresses carry a 12-character code', () => {
  assert.equal('jobs-0123456789ab@lyrtrip.com'.match(j.JOB_REPLY_RE)?.[1], '0123456789ab');
  assert.equal('jobs@lyrtrip.com'.match(j.JOB_REPLY_RE), null);
});

test('keeps only the new part of a reply', () => {
  const text = 'Hi, can you interview Tuesday?\n\nThanks\n\nOn Mon, 3 Nov 2026 at 10:00, Lyrtrip Careers <jobs-abc@lyrtrip.com> wrote:\n> Application for Chef';
  assert.equal(j.stripQuoted(text), 'Hi, can you interview Tuesday?\n\nThanks');
  assert.equal(j.stripQuoted('New\n-----Original Message-----\nold'), 'New');
  assert.equal(j.stripQuoted('New\n\nFrom: A\nSent: B\nold'), 'New');
});

test('the applicant never sees the employer name or contacts', () => {
  const out = j.scrubForApplicant('Acme would like to meet. Call +1 415 555 0100 or mail jane@acme.com, see acme.com/jobs', 'Acme');
  assert.ok(!/acme|555|jane/i.test(out), out);
  assert.match(out, /the employer would like to meet/);
});

test('builds a MIME message with the CV attached that parses back', async () => {
  const raw = j.buildRawEmail({
    from: 'Lyrtrip Careers <jobs-0123456789ab@lyrtrip.com>', to: 'hr@acme.com', replyTo: 'jobs-0123456789ab@lyrtrip.com',
    subject: 'Application for Café manager: José', html: '<p>Hello</p>', text: 'Hello',
    attachments: [{ filename: 'José CV.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.4 test') }],
  });
  const p = await simpleParser(raw);
  assert.equal(p.subject, 'Application for Café manager: José');
  assert.equal(p.replyTo.value[0].address, 'jobs-0123456789ab@lyrtrip.com');
  assert.equal(p.text.trim(), 'Hello');
  assert.equal(p.attachments.length, 1);
  assert.equal(p.attachments[0].content.toString(), '%PDF-1.4 test');
});

test('recognises out-of-office replies', async () => {
  assert.ok(j.isAutoReply(await simpleParser('Subject: Out of office\r\nAuto-Submitted: auto-replied\r\n\r\nAway')));
  assert.ok(!j.isAutoReply(await simpleParser('Subject: Re: Application for Chef\r\n\r\nWhen can you start?')));
});

test('study replies use study-<code> addresses and keep the institution name but not its contacts', () => {
  assert.deepEqual('study-0123456789ab@lyrtrip.com'.match(j.APP_REPLY_RE)?.slice(1), ['study', '0123456789ab']);
  assert.deepEqual('jobs-0123456789ab@lyrtrip.com'.match(j.APP_REPLY_RE)?.slice(1), ['jobs', '0123456789ab']);
  const K = j.MAIL_KINDS.study;
  const a = { program: 'MSc Data Science', institution: { name: 'Oxford University' }, messages: [
    { id: '1', at: 'x', who: 'institution', text: 'Oxford University needs your transcript. Email admissions@ox.ac.uk', attachments: [] },
    { id: '2', at: 'y', who: 'institution', text: 'Out of office', auto: true },
  ] };
  const thread = j.partyThread(K, a);
  assert.equal(thread.length, 1);
  assert.match(thread[0].text, /^Oxford University needs your transcript/);
  assert.ok(!/admissions@/.test(thread[0].text));
  assert.equal(K.sentStatus, 'applied');
});

test('distinctive words of the company name are hidden too, ordinary words are not', () => {
  const out = j.scrubForApplicant('At Canopius, our team at Canopius Group grows. Global solutions matter.', 'Canopius Group Ltd');
  assert.ok(!/canopius/i.test(out), out);
  assert.match(out, /Global solutions matter/);
});

test('admissions addresses rank first in study listings', () => {
  assert.deepEqual(j.employerEmailsIn('Contact info@uni.edu or Admissions@uni.edu', []), ['admissions@uni.edu', 'info@uni.edu']);
});
