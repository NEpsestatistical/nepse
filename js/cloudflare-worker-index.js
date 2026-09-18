/**
 * Video upload Worker — receives PUT /<key> with the raw video file,
 * stores it in the bound R2 bucket, and returns a public URL for it.
 *
 * Why R2: storage is cheap and there's no charge for egress/bandwidth,
 * so a post can be watched any number of times without eating a quota
 * (unlike Supabase Storage, which bills bandwidth on the free/Pro tiers).
 */

const ALLOWED_ORIGIN = "*"; // tighten to your GitHub Pages origin once live, e.g. "https://nepsestatistical.github.io"
const MAX_BYTES = 50 * 1024 * 1024; // keep in sync with MAX_VIDEO_MB in js/feed.js

function cors(resp) {
  resp.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  resp.headers.set("Access-Control-Allow-Methods", "PUT, OPTIONS");
  resp.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return resp;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }
    if (request.method !== "PUT") {
      return cors(new Response("Method not allowed", { status: 405 }));
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!key || key.includes("..")) {
      return cors(new Response("Invalid key", { status: 400 }));
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_BYTES) {
      return cors(new Response("File too large", { status: 413 }));
    }

    // Optional: verify the Supabase JWT sent in Authorization so only signed-in
    // users can upload. Skipped here for simplicity — add a check against your
    // Supabase project's JWKS if you want to enforce it server-side too.

    const contentType = request.headers.get("content-type") || "application/octet-stream";
    await env.VIDEO_BUCKET.put(key, request.body, {
      httpMetadata: { contentType },
    });

    const publicUrl = `${env.PUBLIC_BASE_URL}/${key}`;
    return cors(
      new Response(JSON.stringify({ url: publicUrl }), {
        headers: { "Content-Type": "application/json" },
      })
    );
  },
};
