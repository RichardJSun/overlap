// Letters only, without I and O, so codes can't be confused with 1 and 0.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newRoomCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const isRoomCode = (s: string) => /^[A-HJ-NP-Z]{4}$/.test(s);
