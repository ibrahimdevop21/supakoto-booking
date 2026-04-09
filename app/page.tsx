"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { SessionProvider } from "next-auth/react";

// ─── Config ──────────────────────────────────────────────────────────────────
const BRANCHES = ["التجمع", "زايد", "المعادي"];

const SERVICES = [
  "Takai 5",
  "Gold",
  "Gold Plus",
  "Steel",
  "Steel Plus",
  "Heat Isolation",
  "Others",
];

const AR_MONTHS = [
  "يناير","فبراير","مارس","إبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];
// In RTL grid, index-0 renders on the RIGHT → Sunday on right is correct for Arabic
const DAY_HEADS = ["أح","إث","ثل","أر","خم","جم","سب"];

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  red:        "#bf1e2e",
  redHover:   "#a31826",
  redGlow:    "rgba(191,30,46,0.22)",
  redMuted:   "rgba(191,30,46,0.13)",
  redBorder:  "rgba(191,30,46,0.35)",
  surface:    "rgba(13,20,38,0.72)",
  surfaceHi:  "rgba(20,30,55,0.80)",
  border:     "rgba(51,65,100,0.65)",
  borderBright:"rgba(71,85,120,0.80)",
  text1:      "#f1f5f9",
  text2:      "#cbd5e1",
  text3:      "#64748b",
  success:    "#10b981",
  successBg:  "rgba(16,185,129,0.10)",
  successBd:  "rgba(16,185,129,0.28)",
  warn:       "#f59e0b",
  warnBg:     "rgba(245,158,11,0.10)",
  warnBd:     "rgba(245,158,11,0.28)",
  errBg:      "rgba(191,30,46,0.10)",
  errBd:      "rgba(191,30,46,0.28)",
};

// ─── Shared element styles ────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  backdropFilter: "blur(12px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset",
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "rgba(8,14,28,0.65)",
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  color: T.text1,
  fontSize: 13.5,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.18s, box-shadow 0.18s",
  lineHeight: 1.4,
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 600,
  color: T.text3,
  marginBottom: 5,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const req: React.CSSProperties = { color: T.red, marginRight: 1 };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function calCells(y: number, m: number) {
  const first = new Date(y, m, 1).getDay();
  const days  = new Date(y, m+1, 0).getDate();
  const out: (string|null)[] = [];
  for (let i=0; i<first; i++) out.push(null);
  for (let d=1; d<=days; d++) out.push(toISO(new Date(y,m,d)));
  return out;
}

// ─── Calendar + Slots Panel ───────────────────────────────────────────────────
function CalPanel({
  selectedDate, onDatePick,
}: { selectedDate: string; onDatePick: (d: string) => void }) {
  const now   = new Date();
  const today = toISO(now);

  const [cy, setCy] = useState(now.getFullYear());
  const [cm, setCm] = useState(now.getMonth());

  const [slotsDate, setSlotsDate]   = useState<string|null>(null);
  const [slots, setSlots]           = useState<Record<string,any>|null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const cells = calCells(cy, cm);

  const prevM = () => { if (cm===0){setCy(y=>y-1);setCm(11);}else setCm(m=>m-1); };
  const nextM = () => { if (cm===11){setCy(y=>y+1);setCm(0);}else setCm(m=>m+1); };

  const pickDay = useCallback(async (d: string) => {
    if (d < today) return;
    onDatePick(d);
    setSlotsDate(d);
    setSlotsLoading(true);
    setSlots(null);
    try {
      const res = await fetch(`/api/capacity/all?date=${d}&branches=${encodeURIComponent(BRANCHES.join(","))}`);
      const map = await res.json();
      setSlots(map);
    } catch { setSlots(null); }
    setSlotsLoading(false);
  }, [today, onDatePick]);

  // If form date changes externally (typed), sync highlight
  useEffect(() => {
    if (selectedDate && selectedDate !== slotsDate && selectedDate >= today) {
      const d = new Date(selectedDate);
      if (!isNaN(d.getTime())) { setCy(d.getFullYear()); setCm(d.getMonth()); }
    }
  }, [selectedDate]);  // eslint-disable-line

  const weeks = Math.ceil(cells.length / 7);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, height:"100%" }}>
      {/* Calendar card */}
      <div style={{ ...card, padding:"16px 16px 14px", flex:"none" }}>

        {/* Month nav */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <button onClick={nextM} style={navBtn}>&#8250;</button>
          <span style={{ color:T.text1, fontWeight:700, fontSize:13.5, letterSpacing:"0.01em" }}>
            {AR_MONTHS[cm]} {cy}
          </span>
          <button onClick={prevM} style={navBtn}>&#8249;</button>
        </div>

        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:3 }}>
          {DAY_HEADS.map(h => (
            <div key={h} style={{ textAlign:"center", fontSize:10, fontWeight:600, color:T.text3,
              padding:"3px 0", letterSpacing:"0.03em" }}>{h}</div>
          ))}
        </div>

        {/* Day grid — fixed height based on max 6 weeks */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)",
          gridTemplateRows:`repeat(${weeks},1fr)`, gap:2 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const past     = d < today;
            const isToday  = d === today;
            const isSel    = d === selectedDate;
            const isFri    = new Date(d).getDay() === 5;
            return (
              <button
                key={d}
                disabled={past}
                className="cal-day"
                onClick={() => pickDay(d)}
                style={{
                  aspectRatio:"1",
                  border: isSel ? `1.5px solid ${T.red}` : isToday ? `1px solid ${T.redBorder}` : "1px solid transparent",
                  borderRadius: 7,
                  background: isSel ? T.redMuted : isToday ? "rgba(191,30,46,0.06)" : "transparent",
                  color: past ? T.text3 : isSel ? T.red : isToday ? "#fca5a5" : isFri ? "#94a3b8" : T.text2,
                  fontSize: 12,
                  fontWeight: isSel||isToday ? 700 : 400,
                  cursor: past ? "not-allowed" : "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                  transition: "background 0.12s",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}
              >{new Date(d+"T00:00:00").getDate()}</button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ marginTop:10, display:"flex", gap:12, fontSize:9.5, color:T.text3 }}>
          <span style={{ display:"flex", alignItems:"center", gap:3 }}>
            <span style={{ width:8, height:8, borderRadius:2, border:`1px solid ${T.redBorder}`, display:"inline-block" }}/>
            اليوم
          </span>
          <span style={{ display:"flex", alignItems:"center", gap:3 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:T.redMuted, border:`1px solid ${T.red}`, display:"inline-block" }}/>
            محدد
          </span>
        </div>
      </div>

      {/* Slots card — always reserve space, fills with content when date picked */}
      <div style={{ ...card, padding:"14px 16px", flex:1, minHeight:0, overflow:"hidden" }}>
        {!slotsDate ? (
          <div style={{ height:"100%", display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:8 }}>
            <div style={{ fontSize:22, opacity:.25 }}>📅</div>
            <p style={{ fontSize:11.5, color:T.text3, textAlign:"center", lineHeight:1.5 }}>
              اختار يوم من التقويم<br/>لعرض طاقة الفروع
            </p>
          </div>
        ) : (
          <div className="fade-up">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontSize:10, fontWeight:700, color:T.text3, letterSpacing:"0.05em", textTransform:"uppercase" }}>
                طاقة الفروع
              </span>
              <span style={{ fontSize:11, color:T.text3, background:"rgba(51,65,100,0.4)",
                padding:"2px 8px", borderRadius:20, border:`1px solid ${T.border}` }}>
                {slotsDate}
              </span>
            </div>

            {slotsLoading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:14, paddingTop:4 }}>
                {BRANCHES.map(b => (
                  <div key={b}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12.5, fontWeight:600, color:T.text2 }}>{b}</span>
                      <span style={{ fontSize:11, color:T.text3 }}>جاري...</span>
                    </div>
                    <div style={{ height:5, background:"rgba(51,65,100,0.4)", borderRadius:99 }}>
                      <div style={{ height:"100%", width:"30%", background:T.border, borderRadius:99,
                        animation:"barGrow 1s ease infinite alternate" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : slots ? (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {BRANCHES.map(b => {
                  const s   = slots[b];
                  if (!s) return null;
                  const pct  = s.capacity > 0 ? Math.min((s.booked/s.capacity)*100, 100) : 0;
                  const full = s.full;
                  const low  = !full && s.available <= 2;
                  const clr  = full ? T.red : low ? T.warn : T.success;
                  const bgClr = full ? T.errBg : low ? T.warnBg : T.successBg;
                  const bdClr = full ? T.errBd : low ? T.warnBd : T.successBd;
                  return (
                    <div key={b}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                        <span style={{ fontSize:12.5, fontWeight:600, color:T.text2 }}>{b}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:clr,
                          background:bgClr, border:`1px solid ${bdClr}`,
                          padding:"2px 8px", borderRadius:20 }}>
                          {full ? "ممتلئ 🔴" : low ? `${s.available} متبقي 🟡` : `${s.available} متاح 🟢`}
                        </span>
                      </div>
                      <div style={{ height:5, background:"rgba(51,65,100,0.35)", borderRadius:99, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:clr, borderRadius:99,
                          transition:"width 0.5s cubic-bezier(.4,0,.2,1)",
                          animation:"barGrow 0.5s ease both" }} />
                      </div>
                      <div style={{ marginTop:4, fontSize:10, color:T.text3 }}>
                        {s.booked} / {s.capacity} محجوز
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize:12, color:T.text3, textAlign:"center", paddingTop:8 }}>
                تعذّر تحميل البيانات
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background:"transparent", border:`1px solid ${T.border}`, borderRadius:6,
  color:T.text3, width:26, height:26, display:"flex", alignItems:"center",
  justifyContent:"center", cursor:"pointer", fontSize:16, fontFamily:"inherit",
  padding:0, lineHeight:1, transition:"border-color 0.15s, color 0.15s",
};

// ─── Booking Form ─────────────────────────────────────────────────────────────
function BookingForm() {
  const { data: session } = useSession();
  const salesRep = session?.user?.name ?? "";
  const today    = toISO(new Date());

  const [form, setForm] = useState({
    customer:"", mobile:"", branch:"", car:"",
    service:"", amount:"", appointmentDate:"", notes:"",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const [mobileErr, setMobileErr]   = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const [capState, setCapState]     = useState<any>(null);
  const [capLoading, setCapLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<any>(null);

  // Today's date label — client-side only to avoid hydration mismatch
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString("ar-EG", { weekday:"long", day:"numeric", month:"long" }));
  }, []);

  // Capacity badge
  useEffect(() => {
    if (!form.branch || !form.appointmentDate) { setCapState(null); return; }
    setCapLoading(true);
    fetch(`/api/capacity?branch=${encodeURIComponent(form.branch)}&date=${form.appointmentDate}`)
      .then(r=>r.json()).then(d=>{
        if (d.error || d.available === undefined) { setCapState(null); }
        else { setCapState(d); }
        setCapLoading(false);
      })
      .catch(()=>{ setCapState(null); setCapLoading(false); });
  }, [form.branch, form.appointmentDate]);

  const isFull = capState?.full === true;

  const handleSubmit = async () => {
    const required: (keyof typeof form)[] = ["customer","mobile","branch","car","service","appointmentDate"];
    for (const f of required) if (!form[f]?.trim()) { alert("برجاء ملء كل الحقول المطلوبة"); return; }
    if (!/^[0-9]{10,11}$/.test(form.mobile.trim())) { setMobileErr(true); return; }
    setMobileErr(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...form, salesRep }),
      });
      const data = await res.json();
      if (res.status === 503) {
        setResult({ success:false, type:"config", message:"⚙️ Google Sheets لم يتم ربطه بعد." });
      } else if (!res.ok) {
        const isCapacityError = res.status === 409 && !data?.isDuplicate && /full|ممتلئ/i.test(data?.message || "");
        setResult({
          success:false,
          isDuplicate: Boolean(data?.isDuplicate),
          type: isCapacityError ? "capacity" : "error",
          message: data?.message || data?.error || "حصل خطأ أثناء الحجز",
          alternatives: data?.alternatives || [],
        });
      } else {
        setResult(data);
      }
    } catch(e:any) {
      setResult({ success:false, type:"error", message:"Network error: "+e.message });
    }
    setSubmitting(false);
  };

  const reset = () => {
    setResult(null);
    setForm(f => ({ ...f, customer:"", mobile:"", car:"", amount:"", notes:"" }));
  };

  // Calendar date → form date
  const onCalPick = (d: string) => setForm(f => ({ ...f, appointmentDate:d }));

  // ── Result overlay ────────────────────────────────────────
  if (result) {
    const ok  = result.success;
    const dup = result.isDuplicate;
    const cap = result.type === "capacity";
    return (
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div className="fade-up" style={{
          ...card, width:"100%", maxWidth:460, padding:"28px 24px",
          background: ok ? T.successBg : T.errBg,
          border:`1px solid ${ok ? T.successBd : T.errBd}`,
        }}>
          <p style={{ fontSize:16, fontWeight:700, marginBottom:8,
            color: ok ? T.success : "#fca5a5" }}>
            {ok ? "✅ تم الحجز بنجاح" : dup ? "⚠️ حجز مكرر" : cap ? "⛔ الفرع ممتلئ" : "⚠️ حصل خطأ"}
          </p>
          <p style={{ color:T.text2, fontSize:13, lineHeight:1.65 }}>{result.message}</p>

          {result.alternatives?.length > 0 && (
            <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.errBd}` }}>
              <p style={{ fontSize:10, fontWeight:700, color:T.warn, marginBottom:8,
                letterSpacing:"0.05em", textTransform:"uppercase" }}>📅 أقرب مواعيد متاحة</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {result.alternatives.map((a:any) => (
                  <button key={a.date}
                    onClick={() => { setForm(f=>({...f, appointmentDate:a.date})); setResult(null); }}
                    style={{ padding:"6px 12px", background:T.surfaceHi, border:`1px solid ${T.border}`,
                      borderRadius:7, color:T.text2, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                    {a.date} <span style={{color:T.text3}}>({a.available} متاح)</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} style={{
            width:"100%", marginTop:18, padding:11, background:"transparent",
            border:`1px solid ${T.red}`, borderRadius:9, color:T.red,
            fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
          }}>+ حجز جديد</button>
        </div>
      </div>
    );
  }

  // ── Spinner ───────────────────────────────────────────────
  if (submitting) return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:14 }}>
      <div style={{ width:30, height:30, border:`2.5px solid ${T.border}`,
        borderTopColor:T.red, borderRadius:"50%", animation:"spin 0.75s linear infinite" }}/>
      <p style={{ color:T.text3, fontSize:13 }}>جاري التسجيل...</p>
    </div>
  );

  // ── Main layout ───────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", position:"relative" }}>

      {/* ── Header ── */}
      <header style={{
        height:54, flexShrink:0,
        borderBottom:`1px solid ${T.border}`,
        background:"rgba(8,14,28,0.82)",
        backdropFilter:"blur(14px)",
        display:"flex", alignItems:"center",
        justifyContent:"space-between",
        padding:"0 20px",
        position:"sticky", top:0, zIndex:20,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="SupaKoto" style={{ width:106, height:46, objectFit:"contain" }} />

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ textAlign:"left" }}>
            <div style={{ fontSize:10, color:T.text3, lineHeight:1, marginBottom:2 }}>مرحباً</div>
            <div style={{ fontSize:12.5, color:T.text2, fontWeight:600 }}>{salesRep}</div>
          </div>
          <div style={{ width:1, height:22, background:T.border }}/>
          <button onClick={()=>signOut()} style={{
            background:"transparent", border:`1px solid ${T.border}`, borderRadius:6,
            color:T.text3, fontSize:11, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit",
            transition:"border-color 0.15s, color 0.15s",
          }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.red; e.currentTarget.style.color=T.red; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.text3; }}
          >خروج</button>
        </div>
      </header>

      {/* ── Content ── */}
      <div style={{ flex:1, minHeight:0, padding:"14px 16px 16px",
        maxWidth:1020, margin:"0 auto", width:"100%" }}>
        <div className="booking-layout">

          {/* RIGHT: Form card */}
          <div className="col-form scroll-col" style={{ height:"calc(100vh - 54px - 30px)" }}>
            <div style={{ ...card, padding:"18px 18px 16px" }}>

              {/* Card heading */}
              <div style={{ marginBottom:14, paddingBottom:12, borderBottom:`1px solid ${T.border}` }}>
                <h1 style={{ fontSize:15, fontWeight:700, color:T.text1, marginBottom:2 }}>
                  حجز موعد جديد
                </h1>
                <p style={{ fontSize:11, color:T.text3 }}>
                  {salesRep}{todayLabel ? ` · ${todayLabel}` : ""}
                </p>
              </div>

              {/* ── Customer data ── */}
              <SectionDivider>بيانات العميل</SectionDivider>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="العميل" required>
                  <input className="sk-input" style={inp} placeholder="اسم العميل"
                    value={form.customer} onChange={set("customer")} />
                </Field>
                <Field label="Mobile" required>
                  <input className={`sk-input${mobileErr?" error":""}`}
                    style={{ ...inp, borderColor: mobileErr ? T.red : undefined }}
                    type="tel" placeholder="01xxxxxxxxx"
                    value={form.mobile}
                    onChange={e=>{ setMobileErr(false); setForm(f=>({...f,mobile:e.target.value})); }}
                    onBlur={()=> form.mobile && setMobileErr(!/^[0-9]{10,11}$/.test(form.mobile.trim()))}
                  />
                  {mobileErr && <span style={{ fontSize:10, color:T.red, marginTop:3, display:"block" }}>
                    10 أو 11 رقم
                  </span>}
                </Field>
              </div>

              {/* ── Booking details ── */}
              <SectionDivider>تفاصيل الحجز</SectionDivider>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="الفرع" required>
                  <select className="sk-input" style={inp} value={form.branch} onChange={set("branch")}>
                    <option value="">— اختار —</option>
                    {BRANCHES.map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="الموعد" required>
                  <input className="sk-input" style={inp} type="date" min={today}
                    value={form.appointmentDate} onChange={set("appointmentDate")} />
                </Field>
              </div>

              {/* Capacity badge */}
              {(capLoading || capState) && (
                <div style={{ marginBottom:10, marginTop:-4 }}>
                  {capLoading ? (
                    <span style={{ fontSize:11, color:T.text3, display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:9, height:9, border:`1.5px solid ${T.border}`, borderTopColor:T.red,
                        borderRadius:"50%", display:"inline-block", animation:"spin 0.75s linear infinite" }}/>
                      جاري التحقق...
                    </span>
                  ) : capState && (
                    <CapBadge cap={capState} />
                  )}
                </div>
              )}

              {/* ── Vehicle ── */}
              <SectionDivider>المركبة والخدمة</SectionDivider>
              <Field label="نوع و موديل المركبة" required>
                <input className="sk-input" style={{ ...inp, marginBottom:8 }}
                  placeholder="e.g. Haval H6 2026"
                  value={form.car} onChange={set("car")} />
              </Field>
              <Field label="الخدمة (Service)" required>
                <select className="sk-input" style={{ ...inp, marginBottom:8 }}
                  value={form.service} onChange={set("service")}>
                  <option value="">— اختار الباكدج —</option>
                  {SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="المبلغ (EGP)">
                <input className="sk-input" style={{ ...inp, marginBottom:10 }} placeholder="48000"
                  value={form.amount} onChange={set("amount")} />
              </Field>
              <Field label="ملاحظات">
                <textarea className="sk-input" style={{ ...inp, resize:"vertical", height:110, marginBottom:2 }}
                  placeholder="أي ملاحظات إضافية..."
                  value={form.notes} onChange={set("notes")} />
              </Field>

              {/* Submit */}
              <div style={{ marginTop:12 }}>
                {isFull ? (
                  <div style={{ padding:"11px 16px", background:T.errBg, border:`1px solid ${T.errBd}`,
                    borderRadius:9, color:"#fca5a5", fontSize:12.5, fontWeight:600, textAlign:"center" }}>
                    {capState?.freezeBlocked
                      ? `⚠️ ${capState?.freezeMessage || "هذا الفرع لا يستقبل حجوزات جديدة حاليا."}`
                      : "🔴 الفرع ممتلئ — غيّر التاريخ أو الفرع"}
                  </div>
                ) : (
                  <button onClick={handleSubmit} style={{
                    width:"100%", padding:"12px",
                    background:`linear-gradient(135deg, ${T.red} 0%, #8b1420 100%)`,
                    boxShadow:`0 4px 16px ${T.redGlow}`,
                    color:"#fff", border:"none", borderRadius:9,
                    fontSize:13.5, fontWeight:700, cursor:"pointer",
                    fontFamily:"inherit", letterSpacing:"0.025em",
                    transition:"transform 0.12s, box-shadow 0.15s",
                  }}
                    onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-1px)";
                      e.currentTarget.style.boxShadow=`0 6px 22px ${T.redGlow}`; }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)";
                      e.currentTarget.style.boxShadow=`0 4px 16px ${T.redGlow}`; }}
                    onMouseDown={e=>e.currentTarget.style.transform="translateY(0)"}
                  >
                    تسجيل الموعد ←
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* LEFT: Calendar */}
          <div className="col-cal scroll-col" style={{ height:"calc(100vh - 54px - 30px)" }}>
            <CalPanel selectedDate={form.appointmentDate} onDatePick={onCalPick} />
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Capacity badge ───────────────────────────────────────────────────────────
function CapBadge({ cap }: { cap: any }) {
  const full  = cap.full;
  const freezeBlocked = cap.freezeBlocked === true;
  const low   = !full && cap.available <= 2;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      <span style={{
        display:"inline-flex", alignItems:"center", gap:4, width:"fit-content",
        padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600,
        background: full ? T.errBg  : low ? T.warnBg  : T.successBg,
        border:     `1px solid ${full ? T.errBd : low ? T.warnBd : T.successBd}`,
        color:      full ? "#fca5a5" : low ? T.warn   : T.success,
      }}>
        {full  ? `🔴 ممتلئ ${cap.booked}/${cap.capacity}`
               : low ? `🟡 متبقي ${cap.available} (${cap.booked}/${cap.capacity})`
                     : `🟢 متاح ${cap.available} (${cap.booked}/${cap.capacity})`}
      </span>
      {freezeBlocked && (
        <span style={{ fontSize:11, color:"#fca5a5", lineHeight:1.5 }}>
          ⚠️ {cap.freezeMessage || "هذا الفرع لا يستقبل حجوزات جديدة خلال الفترة الحالية."}
        </span>
      )}
    </div>
  );
}

// ─── Mini helpers ─────────────────────────────────────────────────────────────
function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label style={lbl}>{label}{required && <span style={req}>*</span>}</label>
      {children}
    </div>
  );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8, marginBottom:10,
      fontSize:9.5, fontWeight:700, color:T.red,
      letterSpacing:"0.07em", textTransform:"uppercase",
    }}>
      {children}
      <span style={{ flex:1, height:"1px", background:`linear-gradient(to left, transparent, ${T.border})` }} />
    </div>
  );
}

export default function Page() {
  return <SessionProvider><BookingForm /></SessionProvider>;
}
