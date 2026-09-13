// Small, dependency-free coordinator for the one-time tab-audio disclosure.
// Keeping the decision flow separate makes it possible to test the important
// privacy guarantee: capture cannot start before an explicit Continue action.

export async function requireAudioDisclosure({
  readConsent,
  saveConsent,
  waitForDecision,
}) {
  if (await readConsent()) return true;

  const accepted = await waitForDecision();
  if (!accepted) return false;

  // The caller starts capture only after this function resolves. Persisting
  // consent before returning prevents a second popup from racing the first
  // capture request and showing the disclosure again.
  await saveConsent();
  return true;
}
