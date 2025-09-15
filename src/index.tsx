import React, { useMemo, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Download, Play, RefreshCw, Info } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";

// ---------- Helpers ----------
const RU_MINUS_REGEX = /−/g;
const NBSP_SPACE_REGEX = /[\xA0\s]/g;

function smartParseNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (s === "" || s.toLowerCase() === "nan") return null;
  s = s.replace(RU_MINUS_REGEX, "-");
  s = s.replace(NBSP_SPACE_REGEX, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && !hasDot) s = s.replace(/,/g, ".");
  else if (hasComma && hasDot) s = s.replace(/,/g, "");
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

function parseDateRU(s: unknown): Date | null {
  if (!s) return null;
  if (s instanceof Date) return isNaN(+s) ? null : s;
  const str = String(s).trim();
  const iso = new Date(str);
  if (!isNaN(+iso)) return iso;
  const m1 = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m1) {
    const d = parseInt(m1[1], 10);
    const mo = parseInt(m1[2], 10) - 1;
    const y = parseInt(m1[3].length === 2 ? Number(m1[3]) + 2000 : m1[3], 10);
    const dt = new Date(Date.UTC(y, mo, d));
    return dt;
  }
  return isNaN(+iso) ? null : iso;
}

function formatDateISO(d: Date | string | number): string {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function readExcel(file: File) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
  return rows as Record<string, unknown>[];
}
async function readCsvSmart(file: File) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
  return rows as Record<string, unknown>[];
}

function mergeByDate(exxonRows: Record<string, unknown>[], spRows: Record<string, unknown>[], wtiRows: Record<string, unknown>[]) {
  const exx = (exxonRows || [])
    .map((r) => {
      const d = parseDateRU(r["Дата"] ?? (r as any)["date"] ?? (r as any)["Date"]);
      const price = smartParseNumber(r["Цена last"] ?? (r as any)["Close"] ?? (r as any)["Last"]);
      return d && price != null ? { date: formatDateISO(d), exxon: price } : null;
    })
    .filter(Boolean) as { date: string; exxon: number }[];

  const sp = (spRows || [])
    .map((r) => {
      const d = parseDateRU(r["Дата"] ?? (r as any)["date"] ?? (r as any)["Date"]);
      const v = smartParseNumber(r["Значение"] ?? (r as any)["Value"] ?? (r as any)["Close"]);
      return d && v != null ? { date: formatDateISO(d), sp: v } : null;
    })
    .filter(Boolean) as { date: string; sp: number }[];

  const oi = (wtiRows || [])
    .map((r) => {
      const d = parseDateRU(r["Дата"] ?? (r as any)["date"] ?? (r as any)["Date"]);
      const v = smartParseNumber(r["Цена"] ?? (r as any)["Price"] ?? (r as any)["WTI"]);
      return d && v != null ? { date: formatDateISO(d), wti: v } : null;
    })
    .filter(Boolean) as { date: string; wti: number }[];

  const map = new Map<string, { date: string; exxon?: number; sp?: number; wti?: number }>();
  for (const r of exx) map.set(r.date, { date: r.date, exxon: r.exxon });
  for (const r of sp) {
    const prev = map.get(r.date) || { date: r.date };
    prev.sp = r.sp;
    map.set(r.date, prev);
  }
  for (const r of oi) {
    const prev = map.get(r.date) || { date: r.date };
    prev.wti = r.wti;
    map.set(r.date, prev);
  }

  const merged = Array.from(map.values())
    .filter((r) => r.exxon != null && r.sp != null && r.wti != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return merged as { date: string; exxon: number; sp: number; wti: number }[];
}

// --- ETS --- (same as before)
function hwFitLinear(y: number[], { alpha, beta }: { alpha: number; beta: number }) {
  const n = y.length;
  if (n < 3) throw new Error("Series too short for linear ETS");
  let L = y[0];
  let B = y[1] - y[0];
  const fitted = new Array(n).fill(null) as (number | null)[];
  for (let t = 1; t < n; t++) {
    const yhat = L + B;
    fitted[t] = yhat;
    const prevL = L;
    L = alpha * y[t] + (1 - alpha) * (L + B);
    B = beta * (L - prevL) + (1 - beta) * B;
  }
  const sse = sumSqErr(y, fitted);
  return { fitted, L, B, sse };
}
function hwFitSeasonal(y: number[], m: number, { alpha, beta, gamma, seasonalType = "add" }: { alpha: number; beta: number; gamma: number; seasonalType?: "add" | "mul" }) {
  const n = y.length;
  if (n < m * 2 + 2) throw new Error("Series too short for seasonal ETS (need at least 2 seasons)");
  const season1 = y.slice(0, m);
  const season2 = y.slice(m, 2 * m);
  const L0 = mean(season1), L1 = mean(season2);
  let L = L1, B = (L1 - L0) / m;
  const S = new Array(m) as number[];
  if (seasonalType === "add") for (let i=0;i<m;i++) S[i] = season1[i] - L0;
  else for (let i=0;i<m;i++) S[i] = season1[i] / (L0 === 0 ? 1e-6 : L0);
  const fitted = new Array(n).fill(null) as (number | null)[];
  for (let t=0;t<n;t++) {
    if (t>=m) {
      const sIdx = t % m;
      const yhat = seasonalType === "add" ? L + B + S[sIdx] : (L + B) * S[sIdx];
      fitted[t] = yhat as number;
    }
    const sIdx = t % m, prevL = L;
    if (seasonalType === "add") {
      L = alpha * (y[t] - S[sIdx]) + (1 - alpha) * (L + B);
      B = beta * (L - prevL) + (1 - beta) * B;
      S[sIdx] = gamma * (y[t] - L) + (1 - gamma) * S[sIdx];
    } else {
      const denomS = S[sIdx] === 0 ? 1e-6 : S[sIdx];
      L = alpha * (y[t] / denomS) + (1 - alpha) * (L + B);
      B = beta * (L - prevL) + (1 - beta) * B;
      const denomL = L === 0 ? 1e-6 : L;
      S[sIdx] = gamma * (y[t] / denomL) + (1 - gamma) * S[sIdx];
    }
  }
  const sse = sumSqErr(y, fitted);
  return { fitted, L, B, S, sse };
}
function hwForecastLinear(L:number, B:number, h:number){ const out:number[]=[]; for(let k=1;k<=h;k++) out.push(L+k*B); return out; }
function hwForecastSeasonal(L:number,B:number,S:number[],m:number,h:number,seasonalType:"add"|"mul"="add"){
  const out:number[]=[]; for(let k=1;k<=h;k++){ const sIdx=(k-1)%m; const s=S[sIdx]; const base=L+k*B; out.push(seasonalType==='add'? base+s : base*s); } return out;
}
function sumSqErr(y:number[], fitted:(number|null)[]){ let s=0; for(let i=0;i<y.length;i++){ const f=fitted[i]; if(f!=null){ const e=y[i]-f; s+=e*e; } } return s; }
function mean(a:number[]){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]; return s/a.length; }
function mae(y:number[], fitted:(number|null)[]){ let s=0,c=0; for(let i=0;i<y.length;i++){ if(fitted[i]!=null){ s+=Math.abs(y[i]-(fitted[i] as number)); c++; } } return c? s/c: NaN; }
function rmse(y:number[], fitted:(number|null)[]){ let s=0,c=0; for(let i=0;i<y.length;i++){ if(fitted[i]!=null){ const e=y[i]-(fitted[i] as number); s+=e*e; c++; } } return c? Math.sqrt(s/c): NaN; }
function* grid(values:number[][]){ if(values.length===0) return; function* rec(i:number,acc:number[]){ if(i===values.length){ yield acc; return; } for(const v of values[i]) yield* rec(i+1,[...acc,v]); } yield* rec(0,[]); }
function optimizeLinear(y:number[]){ const al=[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9]; const be=[0.01,0.05,0.1,0.2,0.3,0.5,0.7]; let best:any=null;
  for(const [a,b] of grid([al,be])){ try{ const fit=hwFitLinear(y,{alpha:a,beta:b}); if(!best||fit.sse<best.sse) best={a,b,...fit}; }catch{} } return best; }
function optimizeSeasonal(y:number[],m:number,st:"add"|"mul"){ const al=[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9]; const be=[0.01,0.05,0.1,0.2,0.3,0.5]; const ga=[0.05,0.1,0.2,0.3,0.5]; let best:any=null;
  for(const [a,b,g] of grid([al,be,ga])){ try{ const fit=hwFitSeasonal(y,m,{alpha:a,beta:b,gamma:g,seasonalType:st}); if(!best||fit.sse<best.sse) best={a,b,g,...fit}; }catch{} } return best; }

// ---------- UI ----------
export default function SerenityAnalyticsApp() {
  const [exxonFile, setExxonFile] = useState<File | null>(null);
  const [spFile, setSpFile] = useState<File | null>(null);
  const [wtiFile, setWtiFile] = useState<File | null>(null);

  const gradient = { from: "#1e1b4b", via: "#6d28d9", to: "#9333ea" };
  const [series, setSeries] = useState<number[]>([]);
  const [dates, setDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [horizon, setHorizon] = useState(730);
  const [seasonalPeriod, setSeasonalPeriod] = useState(365);
  const [autoFit, setAutoFit] = useState(true);
  const [alpha, setAlpha] = useState(0.3);
  const [beta, setBeta] = useState(0.1);
  const [gamma, setGamma] = useState(0.1);
  const [results, setResults] = useState<any>(null);

  const handleRun = useCallback(async () => {
    setError(""); setResults(null); setLoading(true); setProgress(5);
    try {
      if (!exxonFile || !spFile || !wtiFile) throw new Error("Загрузите все три набора данных: Exxon, S&P 500 и WTI.");
      const [exxRows, spRows, wtiRows] = await Promise.all([readExcel(exxonFile), readExcel(spFile), readCsvSmart(wtiFile)]);
      setProgress(20);
      const mergedRows = mergeByDate(exxRows, spRows, wtiRows);
      if (!mergedRows.length) throw new Error("Не удалось объединить данные по датам. Проверьте формат колонок.");
      setProgress(35);
      const y = mergedRows.map((r) => r.exxon);
      const dts = mergedRows.map((r) => new Date(r.date + "T00:00:00Z"));
      setSeries(y); setDates(dts);
      const m = seasonalPeriod; setProgress(45);
      let linearBest:any, addBest:any, mulBest:any;
      if (autoFit) {
        linearBest = optimizeLinear(y); setProgress(60);
        addBest = optimizeSeasonal(y, m, "add"); setProgress(80);
        mulBest = optimizeSeasonal(y, m, "mul");
      } else {
        const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0.3));
        const b = Math.max(0, Math.min(1, Number.isFinite(beta) ? beta : 0.1));
        const g = Math.max(0, Math.min(1, Number.isFinite(gamma) ? gamma : 0.1));
        const lin = hwFitLinear(y, { alpha: a, beta: b });
        const add = hwFitSeasonal(y, m, { alpha: a, beta: b, gamma: g, seasonalType: "add" });
        const mul = hwFitSeasonal(y, m, { alpha: a, beta: b, gamma: g, seasonalType: "mul" });
        linearBest = { ...lin, a, b }; addBest = { ...add, a, b, g }; mulBest = { ...mul, a, b, g };
        setProgress(80);
      }
      setProgress(90);
      const linForecast = hwForecastLinear(linearBest.L, linearBest.B, horizon);
      const addForecast = hwForecastSeasonal(addBest.L, addBest.B, addBest.S, m, horizon, "add");
      const mulForecast = hwForecastSeasonal(mulBest.L, mulBest.B, mulBest.S, m, horizon, "mul");
      const toScenarios = (base:number[]) => ({ base, optimistic: base.map(v=>v*1.1), pessimistic: base.map(v=>v*0.9) });
      const res = {
        linear: { params: { alpha: linearBest.a, beta: linearBest.b }, fitted: linearBest.fitted, forecast: linForecast, forecasts: toScenarios(linForecast) },
        add: { params: { alpha: addBest.a, beta: addBest.b, gamma: addBest.g }, fitted: addBest.fitted, forecast: addForecast, forecasts: toScenarios(addForecast) },
        mul: { params: { alpha: mulBest.a, beta: mulBest.b, gamma: mulBest.g }, fitted: mulBest.fitted, forecast: mulForecast, forecasts: toScenarios(mulForecast) },
      };
      const metricsTable = [
        { model: "Линейная", mae: mae(y, res.linear.fitted), rmse: rmse(y, res.linear.fitted) },
        { model: "Аддитивная", mae: mae(y, res.add.fitted), rmse: rmse(y, res.add.fitted) },
        { model: "Мультипликативная", mae: mae(y, res.mul.fitted), rmse: rmse(y, res.mul.fitted) },
      ];
      setResults({ ...res, metricsTable }); setProgress(100);
    } catch (e:any) { console.error(e); setError(e?.message || "Неизвестная ошибка при обработке данных"); }
    finally { setLoading(false); }
  }, [exxonFile, spFile, wtiFile, seasonalPeriod, horizon, autoFit, alpha, beta, gamma]);

  const forecastIndex = useMemo(() => {
    if (!dates.length) return [] as Date[];
    const startMs = dates[dates.length - 1].getTime();
    const idx: Date[] = [];
    for (let i = 1; i <= horizon; i++) idx.push(new Date(startMs + i * 24 * 3600 * 1000));
    return idx;
  }, [dates, horizon]);

  const buildChartData = useCallback((which: "linear" | "add" | "mul") => {
    if (!results || !dates.length) return [] as any[];
    const fit = results[which].fitted as (number | null)[];
    const chart: any[] = [];
    for (let i = 0; i < dates.length; i++) chart.push({ date: formatDateISO(dates[i]), fact: (series as any)[i], fitted: fit[i] ?? null });
    const fidx = forecastIndex;
    const base = results[which].forecasts.base as number[];
    const opt = results[which].forecasts.optimistic as number[];
    const pes = results[which].forecasts.pessimistic as number[];
    for (let i = 0; i < fidx.length; i++) chart.push({ date: formatDateISO(fidx[i]), fact: null, fitted: null, base: base[i], optimistic: opt[i], pessimistic: pes[i] });
    return chart;
  }, [results, dates, series, forecastIndex]);

  const downloadForecastCSV = useCallback(() => {
    if (!results) return;
    const rows: any[] = [];
    const fdates = forecastIndex.map((d) => formatDateISO(d));
    for (let i = 0; i < fdates.length; i++) rows.push({
      date: fdates[i],
      linear_base: results.linear.forecasts.base[i],
      linear_opt: results.linear.forecasts.optimistic[i],
      linear_pes: results.linear.forecasts.pessimistic[i],
      add_base: results.add.forecasts.base[i],
      add_opt: results.add.forecasts.optimistic[i],
      add_pes: results.add.forecasts.pessimistic[i],
      mul_base: results.mul.forecasts.base[i],
      mul_opt: results.mul.forecasts.optimistic[i],
      mul_pes: results.mul.forecasts.pessimistic[i],
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Forecasts");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "serenity_forecasts.xlsx"; a.click(); URL.revokeObjectURL(url);
  }, [results, forecastIndex]);

  const resetAll = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  const gradientStyle = { backgroundImage: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.via} 50%, ${gradient.to} 100%)` } as React.CSSProperties;

  // --- Summary helpers for metrics card ---
  const nObs = dates.length;
  const dateFrom = nObs ? formatDateISO(dates[0]) : "";
  const dateTo = nObs ? formatDateISO(dates[nObs - 1]) : "";
  const bestByRmse = results ? [...results.metricsTable].reduce((min:any, r:any) => (r.rmse < min.rmse ? r : min), results.metricsTable[0]) : null;


  // quick sanity tests (only console.assert in dev)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const a = smartParseNumber("−1,234.56");
      const b = smartParseNumber("1 000,50");
      const c = parseDateRU("31.12.2024");
      console.assert(a === -1234.56); console.assert(b === 1000.5);
      console.assert(c instanceof Date && c.getUTCFullYear() === 2024);
    } catch {}
  }, []);

  return (
    <div className="min-h-screen w-full text-white" style={gradientStyle}>
      <header className="sticky top-0 z-30 backdrop-blur bg-white/0">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-3">
            <img src="/serenity-logo.png" alt="Serenity Analytics" className="h-10 w-10 rounded-2xl object-contain shadow-lg bg-white/20 p-1" />
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Serenity Analytics</h1>
              <p className="text-white/80 text-xs md:text-sm -mt-0.5">Прогнозирование временных рядов для рыночных данных</p>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white" onClick={resetAll}>
              <RefreshCw className="w-4 h-4 mr-2" />Сбросить
            </Button>
            <Button className="bg-white text-violet-700 hover:bg-white/90" onClick={downloadForecastCSV} disabled={!results}>
              <Download className="w-4 h-4 mr-2" />Скачать результаты
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24">
        <div className="grid md:grid-cols-2 gap-4 md:gap-6 mt-6">
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader>
              <CardTitle className="text-white">1) Загрузка данных</CardTitle>
              <CardDescription className="text-white/80">Загрузите три файла в исходном формате.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white">Exxon (Excel, колонки: «Дата», «Цена last»)</Label>
                <Input type="file" accept=".xlsx,.xls" onChange={(e) => setExxonFile(e.target.files?.[0] || null)} className="bg-white/20 text-white placeholder:text-white/70 border-white/30" />
              </div>
              <div>
                <Label className="text-white">S&P 500 (Excel, колонки: «Дата», «Значение»)</Label>
                <Input type="file" accept=".xlsx,.xls" onChange={(e) => setSpFile(e.target.files?.[0] || null)} className="bg-white/20 text-white placeholder:text-white/70 border-white/30" />
              </div>
              <div>
                <Label className="text-white">WTI (CSV, колонки: «Дата», «Цена»)</Label>
                <Input type="file" accept=".csv,.txt" onChange={(e) => setWtiFile(e.target.files?.[0] || null)} className="bg-white/20 text-white placeholder:text-white/70 border-white/30" />
              </div>
              <div className="pt-2 flex gap-2">
                <Button onClick={handleRun} disabled={loading || !exxonFile || !spFile || !wtiFile} className="bg-white text-violet-700 hover:bg-white/90">
                  <Play className="w-4 h-4 mr-2" />Запустить анализ
                </Button>
                {loading && (
                  <div className="flex-1 flex items-center gap-3">
                    <Progress value={progress} className="bg-white/20" />
                    <span className="text-white/80 text-sm min-w-[3rem] text-right">{progress}%</span>
                  </div>
                )}
              </div>
              {error && (
                <div className="mt-2 rounded-xl bg-red-500/20 border border-red-400/40 p-3 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <div>
                    <div className="font-semibold">Ошибка</div>
                    <div className="opacity-90">{error}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader>
              <CardTitle className="text-white">2) Параметры</CardTitle>
              <CardDescription className="text-white/80">Авто‑подбор или ручной ввод параметров ETS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white">Горизонт прогноза (дней)</Label>
                  <Input type="number" min={1} max={1826} value={horizon} onChange={(e) => setHorizon(Number(e.target.value || 0))} className="bg-white/20 text-white border-white/30" />
                </div>
                <div>
                  <Label className="text-white">Сезонность (период)</Label>
                  <Input type="number" min={2} max={400} value={seasonalPeriod} onChange={(e) => setSeasonalPeriod(Number(e.target.value || 0))} className="bg-white/20 text-white border-white/30" />
                  <p className="text-xs text-white/70 mt-1">По умолчанию 365</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Авто‑подбор параметров</Label>
                  <p className="text-white/70 text-xs">Отключите, чтобы ввести α, β, γ вручную.</p>
                </div>
                <Switch checked={autoFit} onCheckedChange={setAutoFit} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-white">Alpha (α)</Label>
                  <Input type="number" step={0.01} min={0} max={1} value={alpha} onChange={(e)=> setAlpha(Number(e.target.value))} disabled={autoFit} className="bg-white/20 text-white border-white/30" />
                </div>
                <div>
                  <Label className="text-white">Beta (β)</Label>
                  <Input type="number" step={0.01} min={0} max={1} value={beta} onChange={(e)=> setBeta(Number(e.target.value))} disabled={autoFit} className="bg-white/20 text-white border-white/30" />
                </div>
                <div>
                  <Label className="text-white">Gamma (γ)</Label>
                  <Input type="number" step={0.01} min={0} max={1} value={gamma} onChange={(e)=> setGamma(Number(e.target.value))} disabled={autoFit} className="bg-white/20 text-white border-white/30" />
                </div>
              </div>
              <p className="text-xs text-white/60">Диапазон: 0…1.</p>
              <div className="rounded-xl bg-white/5 p-3 text-white/90 text-sm">
                <p className="flex items-center gap-2"><Info className="w-4 h-4" />Модели</p>
                <ul className="list-disc list-inside text-white/80 mt-1 space-y-1">
                  <li>Линейная ETS</li>
                  <li>Аддитивная ETS</li>
                  <li>Мультипликативная ETS</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {results && (
          <div className="mt-8 space-y-6">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Качество на обучении</CardTitle>
                <CardDescription className="text-white/80">MAE и RMSE по one‑step fitted values</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-xs text-white/70">Наблюдений</div>
                    <div className="text-base font-semibold">{nObs}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-xs text-white/70">Период</div>
                    <div className="text-base font-semibold">{dateFrom} — {dateTo}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-xs text-white/70">Сезонность</div>
                    <div className="text-base font-semibold">{seasonalPeriod}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-xs text-white/70">Лучшее (RMSE)</div>
                    <div className="text-base font-semibold">{bestByRmse ? bestByRmse.model : '-'}</div>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-white/20">
                  <Table className="w-full text-white">
                    <TableHeader>
                      <TableRow className="bg-white/10">
                        <TableHead className="text-white">Модель</TableHead>
                        <TableHead className="text-white">MAE</TableHead>
                        <TableHead className="text-white">RMSE</TableHead>
                        <TableHead className="text-white">Параметры</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="hover:bg-white/5">
                        <TableCell>Линейная</TableCell>
                        <TableCell>{results.metricsTable[0].mae.toFixed(4)}</TableCell>
                        <TableCell>{results.metricsTable[0].rmse.toFixed(4)}</TableCell>
                        <TableCell>α={results.linear.params.alpha}, β={results.linear.params.beta}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-white/5">
                        <TableCell>Аддитивная</TableCell>
                        <TableCell>{results.metricsTable[1].mae.toFixed(4)}</TableCell>
                        <TableCell>{results.metricsTable[1].rmse.toFixed(4)}</TableCell>
                        <TableCell>α={results.add.params.alpha}, β={results.add.params.beta}, γ={results.add.params.gamma}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-white/5">
                        <TableCell>Мультипликативная</TableCell>
                        <TableCell>{results.metricsTable[2].mae.toFixed(4)}</TableCell>
                        <TableCell>{results.metricsTable[2].rmse.toFixed(4)}</TableCell>
                        <TableCell>α={results.mul.params.alpha}, β={results.mul.params.beta}, γ={results.mul.params.gamma}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="linear" className="w-full">
              <TabsList className="bg-white/10">
                <TabsTrigger value="linear" className="text-white data-[state=active]:bg-white data-[state=active]:text-violet-700">Линейная</TabsTrigger>
                <TabsTrigger value="add" className="text-white data-[state=active]:bg-white data-[state=active]:text-violet-700">Аддитивная</TabsTrigger>
                <TabsTrigger value="mul" className="text-white data-[state=active]:bg-white data-[state=active]:text-violet-700">Мультипликативная</TabsTrigger>
              </TabsList>

              {(["linear", "add", "mul"] as const).map((key) => (
                <TabsContent key={key} value={key}>
                  <Card className="bg-white/10 backdrop-blur border-white/20">
                    <CardHeader>
                      <CardTitle className="text-white">
                        {key === "linear" && "Линейная ETS (тренд)"}
                        {key === "add" && "Аддитивная ETS (тренд + сезонность)"}
                        {key === "mul" && "Мультипликативная ETS (тренд + сезонность)"}
                      </CardTitle>
                      <CardDescription className="text-white/80">Прогноз на {horizon} дней с диапазоном сценариев ±10%</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[420px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={buildChartData(key)} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.25)" />
                            <XAxis dataKey="date" tick={{ fill: "#fff" }} minTickGap={24} />
                            <YAxis tick={{ fill: "#fff" }} domain={["auto", "auto"]} />
                            <Tooltip contentStyle={{ background: "rgba(20,20,35,0.9)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />
                            <Legend />
                            <Line type="monotone" dataKey="fact" name="Факт" stroke="#fff" dot={false} strokeWidth={1.6} />
                            <Line type="monotone" dataKey="fitted" name="Fitted" stroke="#A78BFA" dot={false} strokeWidth={1.6} />
                            <Line type="monotone" dataKey="base" name="Базовый" stroke="#22D3EE" dot={false} strokeDasharray="5 3" strokeWidth={2} />
                            <Line type="monotone" dataKey="optimistic" name="Оптимистичный" stroke="#4ADE80" dot={false} strokeDasharray="4 3" />
                            <Line type="monotone" dataKey="pessimistic" name="Пессимистичный" stroke="#F87171" dot={false} strokeDasharray="4 3" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        <div className="mt-10 text-center text-white/70 text-sm">
          <p>© {new Date().getFullYear()} Serenity Analytics. Продукт для аналитики временных рядов.</p>
        </div>
      </main>
    </div>
  );
}
