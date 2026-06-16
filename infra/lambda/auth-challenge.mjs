import { createHmac } from 'node:crypto';

/**
 * The three Cognito Lambda triggers that implement a CUSTOM_AUTH flow used
 * to bridge non-native identity providers (currently WeChat) into the User
 * Pool. The actual WeChat OAuth code exchange happens in search.mjs
 * (POST /api/auth/wechat); by the time AdminInitiateAuth is called there,
 * the caller has already verified the user's WeChat identity. These
 * triggers just complete a single silent challenge so Cognito issues real
 * User Pool tokens for that (already-verified) user.
 *
 * Wiring: Cognito does not let CloudFormation attach Lambda triggers to a
 * User Pool it doesn't own, so after deploying this function, attach it
 * once with:
 *
 *   aws cognito-idp update-user-pool --user-pool-id <POOL_ID> \
 *     --lambda-config DefineAuthChallenge=<arn>,CreateAuthChallenge=<arn>,VerifyAuthChallengeResponse=<arn> \
 *     ... (merge with any other --lambda-config / pool settings already in place)
 *
 * See SETUP_GUIDE.md for the full command.
 */

function expectedAnswer(openid) {
  const secret = process.env.WECHAT_AUTH_SHARED_SECRET;
  if (!secret) {
    throw new Error('WECHAT_AUTH_SHARED_SECRET is not configured.');
  }
  return createHmac('sha256', secret).update(openid).digest('hex');
}

function defineAuthChallenge(event) {
  const session = event.request.session || [];
  const lastAttempt = session[session.length - 1];

  if (lastAttempt?.challengeName === 'CUSTOM_CHALLENGE' && lastAttempt.challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else if (session.length >= 3) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  }

  return event;
}

function createAuthChallenge(event) {
  const openid = event.request.clientMetadata?.openid;

  if (!openid) {
    throw new Error('Missing openid in client metadata for custom auth challenge.');
  }

  event.response.publicChallengeParameters = {};
  event.response.privateChallengeParameters = { answer: expectedAnswer(openid) };
  event.response.challengeMetadata = 'WECHAT_BRIDGE';

  return event;
}

function verifyAuthChallengeResponse(event) {
  const expected = event.request.privateChallengeParameters.answer;
  const actual = event.request.challengeAnswer;
  event.response.answerCorrect = Boolean(expected) && expected === actual;
  return event;
}

export async function handler(event) {
  switch (event.triggerSource) {
    case 'DefineAuthChallenge_Authentication':
      return defineAuthChallenge(event);
    case 'CreateAuthChallenge_Authentication':
      return createAuthChallenge(event);
    case 'VerifyAuthChallengeResponse_Authentication':
      return verifyAuthChallengeResponse(event);
    default:
      return event;
  }
}
