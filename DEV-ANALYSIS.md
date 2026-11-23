# Dev-window analysis — btc-race-24h-20261123-0511

Window: 2026-11-22 05:12 UTC → 2026-11-23 05:11 UTC, 1.440 bar 1 menit, 0 gap.

## Harga

- Open (close bar pertama): **$58,96** — close bar terakhir: **$61,10**
- Return window: **+3,64%** (tren naik)
- High: $61,84 — Low: $58,66
- Buy-and-hold ≈ final equity $1.033,70 → PnL ≈ **+$33,70**, max drawdown **1,98%**
- 218 bar flat (open == close)

## Struktur per jam (return per jam)

| Jam | Return | Jam | Return |
|-----|--------|-----|--------|
| 00 | +0,15% | 12 | −0,23% |
| 01 | −0,03% | 13 | +0,02% |
| 02 | +0,12% | 14 | +0,02% |
| 03 | +0,87% | 15 | +0,28% |
| 04 | +2,33% | 16 | −0,05% |
| 05 | −0,24% | 17 | −0,00% |
| 06 | +0,42% | 18 | +0,60% |
| 07 | −0,77% | 19 | −0,43% |
| 08 | +0,04% | 20 | −0,26% |
| 09 | +0,18% | 21 | +0,44% |
| 10 | +0,25% | 22 | +0,30% |
| 11 | −0,25% | 23 | −0,14% |

Hampir seluruh kenaikan terjadi di jam 03–04 (+3,2% dalam 2 jam). 20 jam sisanya
sideways/choppy, bergerak ±0,2–0,8% per jam.

## Volatilitas & momentum

- Per-bar log return: mean +0,248 bps, sd **8,12 bps** (sangat kecil per menit)
- Autokorelasi lag-1 return 1 bar: **+0,123** (momentum jangka sangat pendek, lemah-positif)
- Setelah return 24 bar > +1%: rata-rata 15 bar berikut **−0,109%**, 30 bar berikut
  **−0,304%** — mengejar breakout besar cenderung mean-revert; entry harus cepat
  atau menunggu pullback, bukan mengejar puncak.
- Frekuensi return trailing: 24 bar > +0,5% di 148/1.416 bar; > +1% di 58/1.416 bar.

## Implikasi strategi (all-in → TP → all-in lagi)

- Round trip penuh ≈ 26 bps (fee 4 + slippage 2 + impact ~7 bps per sisi). TP harus
  ≥ 0,5% agar margin di atas biaya.
- Kunci dev PnL: **ikut reli jam 03–04** (EMA-cross / breakout cepat masuk, TP
  0,5–1% lalu masuk lagi selama tren naik), dan **jangan berdarah di 20 jam
  sideways** — entry di chop harus selektif (tren EMA masih naik) + stop-loss
  kecil, atau cooldown setelah TP.
- Target realistis: menangkap sebagian dari +3,64% tren dengan beberapa round
  trip TP 1% → PnL dev di kisaran +$10 s.d. +$30 kalau eksekusi bersih.
- Risiko: overfit 1 window. Parameter dipilih yang "masuk akal" (EMA 8/21,
  breakout 24, TP 0,5–1,5%), bukan angka aneh hasil fitting ekstrem.
