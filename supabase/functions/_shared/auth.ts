// Webhook secret karşılaştırması.
//
// Üç fonksiyon da `!==` kullanıyordu. HTTPS üzerinden 64 karakterlik bir
// secret için pratik bir zamanlama saldırısı riski yok — ama doğrusunu
// yazmak da bedava, ve "şu an sömürülemez" bir güvenlik gerekçesi değil.
//
// Uzunluk farkını kasten erken dönmüyoruz: önce sabit uzunluğa getirip
// bütün baytları XOR'luyoruz, böylece karşılaştırma süresi girdiden
// bağımsız kalıyor.
export function secretsMatch(expected: string | undefined, got: string | null): boolean {
  if (!expected) return false; // secret tanımlı değilse hiçbir çağrı güvenilmez
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(got ?? '');
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
