// BTC race bot — all-in -> take-profit -> all-in lagi.
//
// Strategi (perintah bos, verbatim): "Gunakan pola buy all in, terus tp, terus
// all in lagi" — beli ALL-IN (100% kas) saat sinyal entry, jual semua saat
// take-profit tercapai, tunggu sinyal entry berikutnya, all-in lagi, berulang.
//
// Sinyal entry (dipilih lewat ENTRY_MODE):
//   'ema'       — EMA cepat di atas EMA lambat (tren naik), masuk kapan pun tren
//                 masih naik (bukan hanya saat cross), supaya setelah TP bisa
//                 langsung all-in lagi selama tren bertahan.
//   'breakout'  — close menembus high N bar terakhir.
//   'momentum'  — return trailing N bar di atas ambang.
// Exit: take-profit (TP_BPS dari harga entry), stop-loss opsional (SL_BPS),
// trailing stop opsional (TRAIL_BPS dari peak sejak entry), dan untuk mode EMA
// juga keluar saat EMA cepat kembali di bawah EMA lambat.
// Semua parameter di atas file agar mudah diganti; tidak ada angka hasil
// fitting aneh — hanya nilai standar (EMA 8/21, breakout 24, TP 0,5-1,5%).
//
// Hasil grid dev window (49 varian, grade-local --driver process):
//   TERBAIK cluster: EMA-state entry, TP 1,25-1,75%, tanpa exit cross-down,
//   tanpa trailing stop, jeda re-entry 3-8 bar -> dev PnL +$34 s.d. +$36,
//   5-7 trade, max DD ~1,98%. Varian final (tengah cluster, bukan ekstrem):
//   EMA 8/21, TP 1,5%, SL 3% (asuransi race window, tak pernah kena di dev),
//   jeda 5 bar -> dev PnL +$34,53, 5 trade, max DD 1,98%.
//   Yang KALAH di grid: exit cross-down (-$105 s.d. -$151, 74-96 trade),
//   trailing stop (+$0,31 s.d. +$3,64), SL sempit 1-2% + cross-down.
//   Buy-and-hold dev window: +$33,70 — bot ini sedikit di atasnya dengan
//   risiko jauh lebih kecil (hanya 5 trade, selebihnya cash).
//
// Deterministik: hanya memakai harga bar + hello.seed (tidak dipakai, tidak ada
// randomness), tanpa jam dinding, tanpa network, tanpa file di luar repo.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// ---- parameter strategi (ganti di sini untuk grid test) ----
const ENTRY_MODE = 'ema'; // 'ema' | 'breakout' | 'momentum'
const EMA_FAST = 8;
const EMA_SLOW = 21;
const BREAKOUT_N = 24;
const MOMENTUM_N = 24;
const MOMENTUM_MIN_BPS = 50; // entry momentum: return 24 bar > 0,5%
const TP_BPS = 150; // take-profit 1,5% dari harga entry
const SL_BPS = 300; // stop-loss 3% dari harga entry; 0 = mati
  // (di dev window SL tidak pernah kena — dev PnL sama dengan/without SL —
  // tapi di race window ia membatasi rugi satu entry jelek ke ~-3%, jauh di
  // bawah guardrail drawdown 25%)
const TRAIL_BPS = 0; // trailing stop dari peak sejak entry; 0 = mati
const EXIT_ON_CROSS_DOWN = false; // mode ema: jual saat EMA cepat < EMA lambat
  // (MATI — hasil grid: exit cross-down di chop 1 menit menghancurkan PnL:
  // 74-96 trade, -$105 s.d. -$151. Tanpa exit ini: 5 trade, +$34,53.)
const ENTRY_TREND_MIN_BPS = 0; // filter tren: return 24 bar terakhir saat entry
  // harus >= nilai ini (bps); 0 = mati. Menahan entry di jam-jam flat/chop.
const REENTRY_WAIT_BARS = 5; // jeda bar setelah exit sebelum boleh masuk lagi
const ENTRY_CUTOFF_BARS = 1425; // jangan entry baru setelah bar ke-1425 (window 1440)
const MAX_SLIPPAGE_BPS = 100; // 1% dari close terakhir

// ---- state ----
const closes: number[] = []; // close tiap bar (float, skala harga mentah)
let emaFast: number | null = null;
let emaSlow: number | null = null;
const warmFast: number[] = [];
const warmSlow: number[] = [];
let prevGap: number | null = null; // fast - slow bar sebelumnya
let peakRatio = 1; // value/cost tertinggi sejak entry (untuk trailing stop)
let lastExitSeq = -1_000_000;
let wasHolding = false;

function stepEma(value: number | null, warm: number[], span: number, close: number): number | null {
  if (value !== null) return value + (2 / (span + 1)) * (close - value);
  warm.push(close);
  if (warm.length === span) return warm.reduce((a, x) => a + x, 0) / span;
  return null;
}

function entrySignal(): boolean {
  const n = closes.length;
  if (n < 2) return false;
  const c = closes[n - 1];
  // Filter tren: jangan masuk kalau 24 bar terakhir flat/turun.
  if (ENTRY_TREND_MIN_BPS > 0) {
    if (n <= 24) return false;
    const then = closes[n - 1 - 24];
    if (((c - then) / then) * 10_000 < ENTRY_TREND_MIN_BPS) return false;
  }
  if (ENTRY_MODE === 'ema') {
    return emaFast !== null && emaSlow !== null && emaFast > emaSlow;
  }
  if (ENTRY_MODE === 'breakout') {
    if (n <= BREAKOUT_N) return false;
    let hi = -Infinity;
    for (let i = n - 1 - BREAKOUT_N; i < n - 1; i++) if (closes[i] > hi) hi = closes[i];
    return c > hi;
  }
  // momentum
  if (n <= MOMENTUM_N) return false;
  const then = closes[n - 1 - MOMENTUM_N];
  return ((c - then) / then) * 10_000 >= MOMENTUM_MIN_BPS;
}

function exitSignal(state: BarsState): boolean {
  const held = state.positions.get(SYMBOL);
  if (!held) return false;
  const value = state.value(SYMBOL, held.qty);
  if (value <= 0n || held.cost <= 0n) return false;
  // Rasio value/cost dalam bps (integer, eksak): r = value * 10000 / cost.
  const r = (value * 10_000n) / held.cost;
  const ratioBps = Number(r); // mis. 10100 = +1%; peakRatio disimpan dalam satuan yang sama
  if (ratioBps > peakRatio) peakRatio = ratioBps;
  if (ratioBps >= 10_000 + TP_BPS) return true; // take-profit
  if (SL_BPS > 0 && ratioBps <= 10_000 - SL_BPS) return true; // stop-loss
  if (TRAIL_BPS > 0 && ratioBps <= peakRatio - TRAIL_BPS) return true; // trailing
  if (ENTRY_MODE === 'ema' && EXIT_ON_CROSS_DOWN && emaFast !== null && emaSlow !== null && emaFast < emaSlow) return true;
  return false;
}

await runBars({
  onBatch(state, batch) {
    if (state.warmingUp) return [];
    const orders: OrderInput[] = [];
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar) {
      const c = Number(bar.c);
      closes.push(c);
      prevGap = emaFast !== null && emaSlow !== null ? emaFast - emaSlow : null;
      emaFast = stepEma(emaFast, warmFast, EMA_FAST, c);
      emaSlow = stepEma(emaSlow, warmSlow, EMA_SLOW, c);
    }

    const held = state.positions.get(SYMBOL);
    const holding = held !== undefined && held.qty > 0n;
    if (holding && !wasHolding) peakRatio = 10_000; // entry baru: reset peak
    wasHolding = holding;

    // 1) Exit dulu kalau sinyal exit kena (jual semua).
    if (holding && exitSignal(state)) {
      lastExitSeq = state.seq;
      return [{ side: 'sell', symbol: SYMBOL, qty: held!.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }

    // 2) Entry all-in kalau flat, sinyal entry ada, dan cooldown sudah lewat.
    if (!holding && state.cash > 0n && state.seq < ENTRY_CUTOFF_BARS && state.seq - lastExitSeq > REENTRY_WAIT_BARS) {
      if (entrySignal()) {
        const spend = state.cash; // all-in: 100% kas
        if (spend >= BigInt(state.hello.fees.min_notional_quote_units)) {
          orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      }
    }
    return orders;
  },
});
