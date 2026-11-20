// The phrase the real identity is sealed under (tools/seal.mjs) and opened with (core/identity.js).
// It is not a secret and does not pretend to be one: the profile opens the identity for anyone who clicks the
// avatar ten times in a row. Sealing only keeps the real identity out of the site's plain text (the page source,
// search engines); anyone who reads this file can open it.
export const SEAL_PHRASE = 'NX/IDENTITY-LAYER/AS-00';
