import { NextRequest } from "next/server";

const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>تم نقل نظام الحجز</title>
    <style>
      body{font-family: system-ui,-apple-system,Segoe UI,Roboto,"Noto Naskh Arabic",sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh}
      .card{max-width:720px;background:#fff;border-radius:12px;box-shadow:0 6px 24px rgba(15,23,42,0.08);padding:32px;text-align:center}
      h1{margin:0 0 12px;font-size:22px}
      p{margin:8px 0 16px;color:#334155}
      a.button{display:inline-block;background:#0ea5a4;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none}
      .small{font-size:14px;color:#64748b}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>تم نقل نظام الحجز</h1>
      <p>لقد قمنا بترحيل نظام الحجز إلى منصة جديدة. الرجاء إجراء جميع الحجوزات والعمليات عبر الموقع التالي:</p>
      <p><a class="button" href="https://bdm-flow.vercel.app">https://bdm-flow.vercel.app</a></p>
      <p class="small">إذا واجهت مشكلة في تسجيل الدخول أو احتجت مساعدة، يرجى التواصل مع إبراهيم للحصول على الدعم.</p>
    </div>
  </body>
</html>`;

export function middleware(_req: NextRequest) {
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  // Match everything so the app is effectively blocked and shows the migration message.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
