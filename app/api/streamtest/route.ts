// TEMPORARY — W7 streaming spike (delete after verifying).
// Emits 5 lines, one every 500ms. If the client receives them one-by-one over
// ~2.5s, OpenNext/Workers streams incrementally (W7 is viable). If they all
// arrive at once, the response is being buffered (W7 gives no perceived speedup
// and should be reconsidered). Incremental delivery is only provable against a
// real deploy — local `wrangler dev`/`next dev` may buffer.
export async function GET() {
  const enc = new TextEncoder();
  // ~1KB padding per chunk so cumulative bytes pass common ~1KB first-paint
  // buffers (e.g. WebKit) — otherwise a tiny streamed payload can look buffered.
  const pad = " ".repeat(1024);
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 5; i++) {
        controller.enqueue(enc.encode(`chunk ${i} @ ${Date.now()}${pad}\n`));
        await new Promise((r) => setTimeout(r, 500));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Mitigates dev/proxy buffering (research finding).
      "Content-Encoding": "identity",
    },
  });
}
