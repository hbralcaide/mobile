import React, { useMemo, useRef, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// Minimal shape we expose to the parent when a stall/location is selected
export interface StallData {
  id: string;
  label?: string;
  vendorName?: string;
  products?: string[];
  stallNumber?: string;
  floorName?: string;
  vendorIdFromLocation?: string;
}

interface IndoorMarketMapProps {
  onStallPress?: (stall: StallData) => void;
  selectedStallId?: string;
  onSpacesLoaded?: (spaces: Array<{ id: string; name?: string; externalId?: string; floorName?: string }>) => void;
}

// Inline HTML that loads Mappedin Web SDK via ESM CDN inside the WebView.
// IMPORTANT: Do not ship API secrets in production client apps. Prefer short-lived tokens or a public key flow.
function buildMappedinHTML(config: { apiKey?: string; secret?: string; venue?: string; mapId?: string }) {
  const cfgJson = JSON.stringify(config || {});
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <title>Mappedin</title>
    <!-- Mappedin SDK stylesheet for consistent labels/UI -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mappedin/mappedin-js@6.0/lib/esm/styles.css" />
    <style>
      html, body, #app { height: 100%; margin: 0; padding: 0; background: #111; }
      #map { width: 100%; height: 100%; }
      .note { position: absolute; top: 12px; left: 12px; color: #fff; font-family: sans-serif; background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 6px; font-size: 12px; }
    </style>
  </head>
  <body>
    <div id="app">
      <div id="map"></div>
      <div class="note" id="note">Initializing…</div>
    </div>

    <script>
      // Guard postMessage usage
      function postRN(data) {
        try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch (e) {}
      }

      // Receive commands from React Native (e.g., select a stall)
      window.addEventListener('message', function(evt) {
        try {
          var msg = JSON.parse(evt.data || '{}');
          if (msg && msg.type === 'selectStall' && msg.id) {
            if (window.__highlightStall) {
              window.__highlightStall(msg.id);
            }
            postRN({ type: 'ack-select', id: msg.id });
          }
        } catch (e) {}
      });
    </script>

    <script type="module">
      const note = document.getElementById('note');
      const mapEl = document.getElementById('map');
      const config = ${cfgJson};

  // Use CDN ESM import for WebView environment, pinned to v6.0 for stability
  // Note: v6 docs focus on 3D; use show3dMap and later we can lock the camera to top-down to mimic 2D.
  import { getMapData, show3dMap } from 'https://cdn.jsdelivr.net/npm/@mappedin/mappedin-js@6.0/lib/esm/index.min.js';

      async function boot() {
        const hasCreds = !!(config && (config.apiKey || config.secret) && (config.venue || config.mapId));

        if (!hasCreds) {
          note.textContent = 'Mappedin not configured. Add your API credentials and venue.';
          // Demo tap handler so RN wiring can be tested without creds
          mapEl.style.background = 'linear-gradient(135deg,#1f1f1f,#2a2a2a)';
          mapEl.onclick = () => postRN({ type: 'stallSelected', payload: { id: 'demo-stall-1', label: 'Demo Stall' } });
          postRN({ type: 'ready', demo: true });
          return;
        }

        try {
          note.textContent = 'Loading map…';
          // Build request for Mappedin
          const req = {};
          if (config.mapId) req.mapId = config.mapId;
          if (config.venue) req.venue = config.venue;
          if (config.apiKey) req.key = config.apiKey;
          if (config.secret) req.secret = config.secret; // Avoid in production client apps

          const mapData = await getMapData(req);
          const mapView = await show3dMap(mapEl, mapData);
          const labelRegistry = new Map(); // spaceId -> { label, space, text }
          let selectedId = null;
          // Keep mappings for selection payload across handlers
          const spaceIdToLocName = new Map();
          const spaceMeta = new Map(); // spaceId -> { externalId, name, floorName }
          const spaceIdToLocVendorId = new Map(); // spaceId -> location.externalId (vendor id)
          const externalIdToSpaceId = new Map(); // externalId (stall code) -> spaceId

          const normalAppearance = { color: '#000000', backgroundColor: 'rgba(255,255,255,0.75)', fontSize: 12 };
          const selectedAppearance = { color: '#000000', backgroundColor: 'rgba(255,255,255,1.0)', fontSize: 13 };
          // Set an initial camera angle similar to your screenshot (slightly tilted, not fully top-down)
          try {
            if (mapData && mapData.mapCenter) {
              await mapView.setCamera({ center: mapData.mapCenter, zoomLevel: 3.6, pitch: 30, bearing: 0 });
            } else {
              await mapView.setCamera({ zoomLevel: 3.6, pitch: 30, bearing: 0 });
            }
          } catch(_) {}
          note.textContent = 'Map loaded (2D mode)';
          postRN({ type: 'ready', demo: false });

          // Post all spaces/stalls to RN (id/name/externalId/floor)
          try {
            const spaces = (mapData?.getByType ? mapData.getByType('space') : []) || [];
            const simple = spaces.map(s => ({
              id: s?.id,
              name: s?.name,
              externalId: s?.externalId,
              floorName: s?.floor?.name || undefined,
            }));
            // Fill meta lookup for later use on click
            spaces.forEach((s) => {
              try {
                if (s && s.id) {
                  spaceMeta.set(s.id, { externalId: s.externalId, name: s.name, floorName: (s.floor && s.floor.name) || undefined });
                  if (s.externalId) {
                    try { externalIdToSpaceId.set(String(s.externalId).toLowerCase(), s.id); } catch(_){}
                  }
                }
              } catch(_) {}
            });
            postRN({ type: 'spaces', payload: simple });
          } catch (_) {}

          // Force labels for all stalls/spaces to be always visible (prefer Enterprise Location name)
          try {
            const spaces = (mapData?.getByType ? mapData.getByType('space') : []) || [];
            // Some venues use 'enterprise-location', others use 'location' in v6 – merge both for robustness
            const elocs = (mapData?.getByType ? (mapData.getByType('enterprise-location') || []) : []) || [];
            const locs = (mapData?.getByType ? (mapData.getByType('location') || []) : []) || [];
            const locations = [...elocs, ...locs];

            // Build a quick lookup from spaceId -> location name and vendorId (enterprise-location)
            locations.forEach((loc) => {
              try {
                const locName = loc?.name || loc?.label;
                const locExtId = loc?.externalId || loc?.external_id || undefined;
                if (!locName && !locExtId) return;
                // Try common shapes of the relationship
                const candidates = [];
                if (Array.isArray(loc?.spaces)) candidates.push(...loc.spaces);
                if (loc?.space) candidates.push(loc.space);
                if (Array.isArray(loc?.anchors)) candidates.push(...loc.anchors);
                if (Array.isArray(loc?.relatedSpaces)) candidates.push(...loc.relatedSpaces);
                candidates.forEach((t) => {
                  const sid = t?.id || t?.spaceId || t?.targetId;
                  if (!sid) return;
                  if (locName && !spaceIdToLocName.has(sid)) spaceIdToLocName.set(sid, locName);
                  if (locExtId && !spaceIdToLocVendorId.has(sid)) spaceIdToLocVendorId.set(sid, String(locExtId));
                });
              } catch (_) { /* ignore bad loc */ }
            });

            if (mapView?.Labels && typeof mapView.Labels.add === 'function') {
              spaces.forEach((s) => {
                try {
                  if (!s) return;
                  // Prefer stable stall code for labels; fall back to Location name, then Space name
                  const text = s?.externalId || spaceIdToLocName.get(s.id) || s?.name;
                  if (!text) return;
                  const lbl = mapView.Labels.add(s, String(text), {
                    rank: 'always-visible',
                    interactive: false,
                    appearance: normalAppearance,
                  });
                  if (lbl && s.id) labelRegistry.set(s.id, { label: lbl, space: s, text: String(text) });
                } catch (e) { /* no-op per space */ }
              });
            }
          } catch (_) {}

          // Expose a highlighter for RN -> WebView sync
          window.__highlightStall = async function(spaceId) {
            try {
              if (!spaceId) return;
              // Reset previous
              if (selectedId && selectedId !== spaceId) {
                const prev = labelRegistry.get(selectedId);
                if (prev && prev.label && mapView?.Labels) {
                  try { mapView.Labels.remove(prev.label); } catch(_){ }
                  prev.label = mapView.Labels.add(prev.space, prev.text, { rank: 'always-visible', interactive: false, appearance: normalAppearance });
                  labelRegistry.set(selectedId, prev);
                }
              }
              // Highlight new
              const curr = labelRegistry.get(spaceId);
              if (curr && mapView?.Labels) {
                try { if (curr.label) mapView.Labels.remove(curr.label); } catch(_){ }
                curr.label = mapView.Labels.add(curr.space, curr.text, { rank: 'always-visible', interactive: false, appearance: selectedAppearance });
                labelRegistry.set(spaceId, curr);
                selectedId = spaceId;
                // Optionally center camera on it
                try { await mapView.setCamera({ center: curr.space.centroid || curr.space.center || mapData.mapCenter, pitch: 0, bearing: 0 }); } catch(_){ }
              }
            } catch(_){ }
          }

          // Lock camera to a fixed angle (pitch=30) and allow only zoom and pan (swipe)
          try {
            // Initial lock
            await mapView.setCamera({ pitch: 30, bearing: 0 });
            // Disable all rotation and tilt gestures
            if (mapView.interactivity && typeof mapView.interactivity.setOptions === 'function') {
              mapView.interactivity.setOptions({ rotate: false, tilt: false, rotateWithPinch: false, pan: true, zoom: true });
            }
            // Clamp zoom to a practical range
            try { if (typeof mapView.setZoomLimits === 'function') mapView.setZoomLimits(2.0, 6.0); } catch(_){}

            // Always force camera to fixed angle on any change
            const lockAngle = () => {
              try { mapView.setCamera({ pitch: 30, bearing: 0 }); } catch (_) {}
            };
            if (typeof mapView.on === 'function') {
              mapView.on('camera-change', lockAngle);
              // Block rotate/tilt gestures
              try {
                mapView.on('gesture-start', (g) => { if (g && (g.type === 'rotate' || g.type === 'tilt')) { try { g.preventDefault && g.preventDefault(); } catch(_){} lockAngle(); } });
                mapView.on('gesture-update', (g) => { if (g && (g.type === 'rotate' || g.type === 'tilt')) { lockAngle(); } });
              } catch(_){}
            }
          } catch (_) {}

          // Real selection: include vendorName (enterprise location), stall number (externalId), and floor
          try {
            if (typeof mapView.on === 'function') {
              mapView.on('click', (ev) => {
                let id = 'tap';
                let label = 'Map Tap';
                let vendorName = undefined;
                let externalId = undefined;
                let floorName = undefined;
                let vendorIdFromLocation = undefined;
                try {
                  const collect = [];
                  if (ev && Array.isArray(ev.items)) collect.push(...ev.items);
                  if (ev && Array.isArray(ev.targets)) collect.push(...ev.targets);
                  if (ev && Array.isArray(ev.intersections)) collect.push(...ev.intersections.map(x => x && (x.object || x)));
                  if (ev && ev.space) collect.push(ev.space);
                  if (ev && ev.detail && Array.isArray(ev.detail.items)) collect.push(...ev.detail.items);
                  const picked = collect.find(x => (x && (x.type === 'space' || x.kind === 'space' || x.name))) || null;
                  if (picked) {
                    id = picked.id || picked.externalId || picked.uuid || id;
                    const meta = spaceMeta.get(picked.id) || {};
                    // Prefer stall code for the label display
                    label = meta.externalId || picked.name || picked.label || id;
                    try {
                      vendorName = spaceIdToLocName.get(picked.id) || undefined;
                      externalId = picked.externalId || meta.externalId;
                      floorName = (picked.floor && picked.floor.name) || meta.floorName;
                      vendorIdFromLocation = spaceIdToLocVendorId.get(picked.id) || undefined;
                    } catch(_) {}
                  } else {
                    // Fallback heuristic: try to parse a stall code from any text/label in hit-test payload
                    try {
                      const texts = [];
                      collect.forEach((x) => {
                        try {
                          if (typeof x?.text === 'string') texts.push(x.text);
                          if (typeof x?.label === 'string') texts.push(x.label);
                          if (typeof x?.name === 'string') texts.push(x.name);
                        } catch(_) {}
                      });
                      if (ev && ev.detail) {
                        try {
                          if (typeof ev.detail.text === 'string') texts.push(ev.detail.text);
                          if (typeof ev.detail.label === 'string') texts.push(ev.detail.label);
                        } catch(_) {}
                      }
                      // Look for patterns like M-30, m-30, M30, A12, etc.
                      let resolvedSpaceId = null;
                      let resolvedCode = null;
                      const tryResolveCode = (raw) => {
                        if (!raw || typeof raw !== 'string') return null;
                        const str = raw.trim();
                        // Extract first plausible code
                        const m = str.match(/([A-Za-z]{1,3})-?(\d{1,4})/);
                        if (!m) return null;
                        const letters = m[1].toUpperCase();
                        const digits = m[2];
                        const withHyphen = letters + '-' + digits;
                        const noHyphen = letters + digits;
                        return { withHyphen, noHyphen };
                      };
                      for (let i = 0; i < texts.length && !resolvedSpaceId; i++) {
                        const cand = tryResolveCode(texts[i]);
                        if (!cand) continue;
                        const a = externalIdToSpaceId.get(cand.withHyphen.toLowerCase());
                        const b = externalIdToSpaceId.get(cand.noHyphen.toLowerCase());
                        const c = (() => {
                          // As a last resort, compare against labelRegistry text values
                          try {
                            for (const [sid, rec] of labelRegistry.entries()) {
                              const t = String(rec?.text || '').toLowerCase();
                              if (t === cand.withHyphen.toLowerCase() || t === cand.noHyphen.toLowerCase()) return sid;
                            }
                          } catch(_) {}
                          return null;
                        })();
                        resolvedSpaceId = a || b || c;
                        if (resolvedSpaceId) {
                          resolvedCode = cand.withHyphen;
                        }
                      }
                      if (resolvedSpaceId) {
                        id = resolvedSpaceId;
                        const meta = spaceMeta.get(resolvedSpaceId) || {};
                        label = meta.externalId || resolvedCode || 'Stall';
                        try {
                          vendorName = spaceIdToLocName.get(resolvedSpaceId) || undefined;
                          externalId = meta.externalId || resolvedCode;
                          floorName = meta.floorName;
                          vendorIdFromLocation = spaceIdToLocVendorId.get(resolvedSpaceId) || undefined;
                        } catch(_) {}
                      }
                    } catch(_) {}
                  }
                } catch (_) {}
                postRN({ type: 'stallSelected', payload: { id, label, vendorName, externalId, floorName, vendorIdFromLocation } });
                if (id && window.__highlightStall) window.__highlightStall(id);
              });
            } else {
              // Fallback
              mapEl.addEventListener('click', () => {
                postRN({ type: 'stallSelected', payload: { id: 'tap', label: 'Map Tap' } });
              });
            }
          } catch (_) {}
        } catch (e) {
          const msg = String((e && e.message) || e);
          note.textContent = 'Failed to load Mappedin SDK: ' + msg;
          postRN({ type: 'error', message: msg });
        }
      }
      boot();
    </script>
  </body>
  </html>`;
}

const IndoorMarketMap: React.FC<IndoorMarketMapProps> = ({ onStallPress, selectedStallId, onSpacesLoaded }) => {
  const webRef = useRef<WebView>(null);

  // TODO: Move credentials to a secure source. For now, placeholders for testing only.
  const mappedinConfig = useMemo(
    () => ({
      apiKey: 'mik_tAAV0Kglf8cq4yaNy528a0782',
      secret: 'mis_UmzVGNuR3WqD742REeI4ozSxNTlBDnTJs5So0Jx2vm6858a0fe7',
      venue: '',
      mapId: '68ee9141b47af0000bc138c1', // Davao City
    }),
    []
  );

  const html = useMemo(() => buildMappedinHTML(mappedinConfig), [mappedinConfig]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data || '{}');
      if (data?.type === 'stallSelected' && onStallPress) {
        onStallPress({
          id: data.payload?.id,
          label: data.payload?.label,
          vendorName: data.payload?.vendorName,
          stallNumber: data.payload?.externalId || data.payload?.stallNumber,
          floorName: data.payload?.floorName,
          vendorIdFromLocation: data.payload?.vendorIdFromLocation,
        });
        return;
      }
      if (data?.type === 'spaces' && Array.isArray(data?.payload)) {
        if (onSpacesLoaded) onSpacesLoaded(data.payload);
        else console.log(`Mappedin: received ${data.payload.length} spaces`);
        return;
      }
      if (data?.type === 'error' && data?.message) {
        // Surface exact Mappedin error to help diagnose (auth, permissions, network)
        Alert.alert('Mappedin error', String(data.message));
        return;
      }
      if (data?.type === 'ready') {
        // Optional: could show a toast/log for ready state
        // console.log('Mappedin ready', data);
        return;
      }
    } catch {
      // ignore
    }
  };

  // When selectedStallId changes, inform the WebView (e.g., to highlight)
  useEffect(() => {
    if (selectedStallId && webRef.current) {
      const msg = JSON.stringify({ type: 'selectStall', id: selectedStallId });
      webRef.current.postMessage(msg);
    }
  }, [selectedStallId]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}><ActivityIndicator size="large" color="#4CAF50" /></View>
        )}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});

export default IndoorMarketMap;
