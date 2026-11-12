// Supabase Edge Function: send-email
// Deploy with: supabase functions deploy send-email
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DEFAULT_FROM_EMAIL = Deno.env.get("DEFAULT_FROM_EMAIL") || "Nirvana <notifications@nirvana.app>";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { to, from, subject, text, html } = await req.json();

    if (!to || !subject || (!text && !html)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, text/html" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const recipients = Array.isArray(to) ? to : [to];
    const sender = from || DEFAULT_FROM_EMAIL;

    // Option 1: Resend integration configured in Supabase secrets
    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: sender,
          to: recipients,
          subject,
          text,
          html: html || `<p>${text.replace(/\n/g, "<br>")}</p>`,
        }),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Option 2: Fallback logging mode for local or development testing
    console.log(`[Supabase send-email] Delivered to: ${recipients.join(", ")} | Subject: ${subject}`);
    return new Response(
      JSON.stringify({
        ok: true,
        message: "Email processed by Supabase Edge Function",
        recipients,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

