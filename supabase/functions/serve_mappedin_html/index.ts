// supabase/functions/serve_mappedin_html/index.ts
Deno.serve((_req) => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Toril Public Market Map</title>
  <style>html,body{height:100%;margin:0;padding:0;overflow:hidden}#mappedin-container{width:100%;height:100%}</style>
  <script src="https://cdn.mappedin.com/web/2.191.0/mappedin.js"></script>
</head>
<body>
  <div id="mappedin-container"></div>
  <script>
    // RN will post a message { type: "mappedin_token", token: "..." }
    const VENUE_SLUG = "toril-public-market"; // replace if needed

    window.addEventListener("message", async (ev) => {
      try {
        const msg = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (msg?.type === "mappedin_token" && msg?.token) await initMappedin(msg.token);
      } catch(e) { console.error("msg parse error", e); }
    });

    async function initMappedin(token) {
      try {
        const mapView = await window.mappedin.initialize({
          token,
          venue: VENUE_SLUG,
          container: document.getElementById("mappedin-container")
        });

        mapView.on("click", (event) => {
          if (!event?.locations?.length) return;
          const poi = event.locations[0];
          // send to RN host
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: "poi_click",
            payload: {
              id: poi.id,
              name: poi.name,
              zoneId: poi.space?.id,
              zoneName: poi.space?.name
            }
          }));
        });
      } catch (err) { console.error("Mappedin init error:", err); }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // optional, safer CSP - adjust if it blocks mappedin CDN
      "Content-Security-Policy": "default-src 'self' https://cdn.mappedin.com; script-src 'self' https://cdn.mappedin.com; style-src 'unsafe-inline' 'self';",
    }
  });
});
