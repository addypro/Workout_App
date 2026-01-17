import * as Crypto from 'expo-crypto';

export async function stableHash(input: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return digest.slice(0, 16);
}
