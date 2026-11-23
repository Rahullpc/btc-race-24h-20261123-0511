# BTC Race Bot — all-in → take-profit → all-in lagi

[![make.fun bounty](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/bounty/btc-race-24h-20261123-0511)

Bot trading untuk bounty make.fun
[Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261123-0511):
trading Coinbase Wrapped BTC (cbBTC) di bar 1 menit, modal paper $1.000 USDC,
long only, maksimal 1 posisi.

## Strategi

> "Gunakan pola buy all in, terus tp, terus all in lagi"

- **Entry all-in (100% kas)** saat EMA(8) di atas EMA(21) — tren naik. Entry
  bukan hanya saat cross, supaya setelah take-profit bot bisa langsung all-in
  lagi selama tren masih naik.
- **Take-profit 1,5%** dari harga entry → jual semua, lalu tunggu sinyal
  entry berikutnya (jeda 5 bar setelah exit).
- **Stop-loss 3%** sebagai asuransi race window (tidak pernah kena di dev
  window) — membatasi rugi satu entry jelek, jauh di bawah guardrail
  drawdown 25%.
- **Tidak ada** exit cross-down dan **tidak ada** trailing stop: grid dev
  window membuktikan keduanya menghancurkan PnL di chop 1 menit
  (cross-down: -$105 s.d. -$151 dengan 74–96 trade; trailing: +$0,31 s.d.
  +$3,64).

Semua parameter ada di konstanta atas `main.ts` (mudah diganti, tanpa angka
fitting aneh — hanya nilai standar EMA 8/21, TP 1,5%, SL 3%).

## Hasil dev window (grade-local, `--driver process`)

| Metrik | Nilai |
|---|---|
| Net PnL | **+$34,53 USDC** (+3,45%) |
| Trade | 5 (win rate 100%) |
| Max drawdown | 1,98% |
| Fee | $2,45 (PnL di 2x fee: +$32,06) |
| Guardrails | terpenuhi (≥1 trade, DD ≤25%) |
| Determinisme | L1 regrade reproduced byte for byte |

Perbandingan: buy-and-hold di dev window yang sama +$33,70 — bot ini sedikit
di atasnya dengan risiko jauh lebih kecil (hanya 5 trade, selebihnya cash).
Dev gate lolos (PnL > $0).

Grid lengkap 49 varian (EMA / breakout / momentum × TP 0,5–3% × SL / trailing /
jeda re-entry) ada diringkas di komentar atas `main.ts`; analisis dev window
di [`DEV-ANALYSIS.md`](DEV-ANALYSIS.md).

## Struktur repo

```
main.ts                  # entrypoint bot (Node 22, TypeScript erasable)
vendor/makefun-bars.ts   # shim protokol agent-fun/bars-replay/v1, salinan
                         # byte-for-byte dari kit (dikecualikan dari authorship)
DEV-ANALYSIS.md          # analisis dev window
README.md
LICENSE                  # MIT
```

## Menjalankan / grading lokal

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

Bot deterministik mutlak: tanpa network, tanpa jam dinding, tanpa file di luar
repo; dua run pada data yang sama menghasilkan order identik.

## Lisensi

MIT — lihat [`LICENSE`](LICENSE).
