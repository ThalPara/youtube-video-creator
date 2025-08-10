import React, { useEffect, useMemo, useRef, useState } from "react";

// YouTube Content Studio – single-file React app
// Adds Light/Dark theme toggle with localStorage + prefers-color-scheme

const STORAGE_KEY = "yt_content_studio_v8";
const THEME_KEY = "ytcs_theme";
const nowISO = () => new Date().toISOString();
const fmt = (iso) => new Date(iso).toLocaleString();
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function useLocalStorageArray(key, initial) {
  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : initial;
      return Array.isArray(parsed) ? parsed : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(key, JSON.stringify(items)); } catch {}
  }, [key, items]);
  return [items, setItems];
}

function useTheme(defaultMode = "system") {
  const getInitial = () => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return defaultMode;
  };
  const [mode, setMode] = useState(getInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const effective = mode === "system"
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    root.dataset.theme = effective; // used by CSS
    try { window.localStorage.setItem(THEME_KEY, mode); } catch {}
  }, [mode]);

  return [mode, setMode];
}

export default function YouTubeContentStudio(){
  const [items, setItems] = useLocalStorageArray(STORAGE_KEY, []);
  const [mode, setMode] = useTheme(); // "light" | "dark" | "system"
  const [query, setQuery] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [toast, setToast] = useState("");
  const [collapsed, setCollapsed] = useState({}); // video-level collapse
  const [subCollapsed, setSubCollapsed] = useState({}); // section-level collapse
  const fileInputRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(()=> setToast(""), 2000); };

  const createBase = (type, parentId=null) => ({ id: uid(), type, parentId, title: "", content: "", tags: [], status: "idea", createdAt: nowISO(), updatedAt: nowISO() });
  const createVideo = () => {
    const v = { ...createBase("video"), title: "New Video" };
    setItems(prev => [v, ...prev]);
    setCollapsed(prev => ({ ...prev, [v.id]: false }));
    showToast("Video created");
  };
  const createChild = (videoId, type) => {
    let base = createBase(type, videoId);
    if (type === "headline") base.content = "Punchy headline idea";
    if (type === "script") base.title = "Script";
    if (type === "thumbnail") base.title = "Thumbnail";
    setItems(prev => [base, ...prev]);
    showToast(`${type[0].toUpperCase()+type.slice(1)} added`);
  };
  const upsertItem = (item) => setItems(prev => prev.map(p => p.id === item.id ? {...item, updatedAt: nowISO()} : p));
  const removeItem = (id) => { setItems(prev => prev.filter(p => p.id !== id && p.parentId !== id)); showToast("Deleted"); };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `yt-studio-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast("Exported JSON");
  };

  const onImport = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { const data = JSON.parse(String(reader.result)); if (Array.isArray(data)) { setItems(data); showToast("Imported JSON"); } else showToast("Invalid JSON"); }
      catch { showToast("Invalid JSON"); }
    };
    reader.readAsText(file);
  };

  const saveEdit = () => { if (editingItem) { upsertItem(editingItem); setEditingItem(null); showToast("Saved"); } };

  const videos = useMemo(() => items.filter(i => i.type === "video" && (i.title.toLowerCase().includes(query.toLowerCase()) || query === "")), [items, query]);
  const childrenOf = (videoId) => items.filter(i => i.parentId === videoId);

  const css = `
    :root{--bg:#0b1020;--text:#e5e7eb;--muted:#9aa7bd;--panel:#10172a;--panel2:#0f1326;--stroke:#1f2937;--stroke2:#243049;--brand:#6d95ff;--accent:#5a7ee6}
    :root[data-theme='light']{--bg:#f8fafc;--text:#0b1224;--muted:#6b7280;--panel:#ffffff;--panel2:#f1f5f9;--stroke:#e5e7eb;--stroke2:#d1d5db;--brand:#3b82f6;--accent:#2563eb}

    *{box-sizing:border-box}body{margin:0}
    .app{min-height:100vh;background:radial-gradient(1200px 600px at -10% -10%, #1f2a4422 0%, transparent 60%), radial-gradient(900px 500px at 110% -10%, #0b3b5e22 0%, transparent 60%), var(--bg); color:var(--text);font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial}
    .header{position:sticky;top:0;background:color-mix(in oklab, var(--bg), transparent 20%);backdrop-filter:blur(8px);border-bottom:1px solid var(--stroke);z-index:10}
    .header-inner{max-width:1100px;margin:0 auto;padding:14px 20px;display:flex;gap:10px;align-items:center}
    .input{background:var(--panel2);border:1px solid var(--stroke2);color:var(--text);padding:10px 12px;border-radius:12px;outline:none;min-width:240px}
    .input:focus{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in oklab, var(--brand), transparent 80%)}
    .btn{border:1px solid var(--stroke2);background:var(--panel);color:var(--text);padding:8px 10px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;gap:.4rem}
    .btn:hover{border-color:var(--brand)}
    .btn.primary{background:linear-gradient(180deg,var(--brand),var(--accent));border-color:var(--accent);color:white}
    .toolbar{display:flex;gap:8px;align-items:center;margin-left:auto}
    .container{max-width:1100px;margin:0 auto;padding:20px}
    .grid{display:grid;gap:16px;grid-template-columns:1fr}
    .card{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--stroke);border-radius:16px;overflow:hidden;box-shadow:0 8px 26px #0004}
    .card-h{padding:12px 14px;background:var(--panel2);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--stroke)}
    .card-content{padding:14px}
    .meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:flex-end;color:var(--muted);font-size:.9rem}
    .pill{font-size:.8rem;padding:3px 8px;border-radius:999px;background:color-mix(in oklab, var(--panel2), var(--bg) 30%);border:1px solid var(--stroke2)}
    .rows{display:flex;flex-direction:column;gap:8px;margin-top:8px}
    .row{display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid var(--stroke2);border-radius:12px;background:var(--panel2)}
    .footer{padding:10px 14px;border-top:1px solid var(--stroke);display:flex;justify-content:space-between;color:var(--muted);font-size:.85rem}
    .toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid var(--stroke2);color:var(--text);padding:8px 12px;border-radius:10px}
    .modal{position:fixed;inset:0;background:#0007;display:flex;align-items:center;justify-content:center;padding:20px}
    .modal-card{width:min(560px,90vw);background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--stroke);border-radius:14px;overflow:hidden}
    .modal-h{padding:12px 14px;border-bottom:1px solid var(--stroke);font-weight:800}
    .modal-b{padding:14px;display:grid;gap:10px}
    .field input,.field textarea,.field select{width:100%;background:var(--panel2);border:1px solid var(--stroke2);color:var(--text);padding:10px 12px;border-radius:10px}
    .sectionHead{background:var(--panel2);border:1px solid var(--stroke2);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;margin-top:10px}
  `;

  return (
    <div className="app">
      <style>{css}</style>

      <div className="header">
        <div className="header-inner">
          <div style={{fontWeight:800}}>📺 YouTube Content Studio</div>
          <input className="input" placeholder="Search videos…" value={query} onChange={(e)=> setQuery(e.target.value)} />
          <div className="toolbar">
            <button className="btn" onClick={()=> fileInputRef.current?.click()}>📥 Import</button>
            <button className="btn" onClick={exportJson}>📤 Export</button>
            <button className="btn" onClick={createVideo}>➕ New Video</button>
            <select className="input" style={{minWidth:120}} value={mode} onChange={(e)=> setMode(e.target.value)} title="Theme">
              <option value="system">🖥️ System</option>
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark</option>
            </select>
            <input ref={fileInputRef} type="file" accept="application/json" style={{display:'none'}} onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onImport(f); e.currentTarget.value=""; }} />
          </div>
        </div>
      </div>

      <div className="container">
        {videos.length ? (
          <div className="grid">
            {videos.map(v => {
              const kids = childrenOf(v.id);
              const scripts = kids.filter(k=>k.type==='script');
              const thumbs = kids.filter(k=>k.type==='thumbnail');
              const heads = kids.filter(k=>k.type==='headline');
              const isCollapsed = collapsed[v.id];

              const Section = ({label, data, type}) => {
                const subId = `${v.id}:${label}`;
                const subIsCollapsed = subCollapsed[subId] ?? false; // default open
                return (
                  <div>
                    <div className="sectionHead" onClick={()=> setSubCollapsed(prev=>({ ...prev, [subId]: !subIsCollapsed }))}>
                      <span style={{display:'flex',alignItems:'center',gap:8}}>{subIsCollapsed ? '▸' : '▾'} {label} <span className="pill">{data.length}</span></span>
                      <span style={{display:'flex',alignItems:'center',gap:8}}>
                        {type==='script' && (
                          <button className="btn" onClick={(e)=>{ e.stopPropagation(); createChild(v.id,'script'); }}>➕ New</button>
                        )}
                        {type==='thumbnail' && (
                          <button className="btn" onClick={(e)=>{ e.stopPropagation(); createChild(v.id,'thumbnail'); }}>➕ Add</button>
                        )}
                        {type==='headline' && (
                          <button className="btn" onClick={(e)=>{ e.stopPropagation(); createChild(v.id,'headline'); }}>➕ Add</button>
                        )}
                      </span>
                    </div>
                    {!subIsCollapsed && (
                      <div className="rows">
                        {data.length ? data.map(item => (
                          <div key={item.id} className="row">
                            <div>{item.type==='script'?'📝':item.type==='thumbnail'?'🖼️':'💬'} {item.title || 'Untitled'}</div>
                            <div className="meta">
                              <span className="pill">{item.status}</span>
                              <button className="btn" onClick={()=> setEditingItem(item)}>✏️ Edit</button>
                              <button className="btn" onClick={()=> removeItem(item.id)}>🗑️ Delete</button>
                            </div>
                          </div>
                        )) : <div className="row" style={{justifyContent:'center',color:'var(--muted)'}}>Empty</div>}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div key={v.id} className="card">
                  <div className="card-h" onClick={()=> setCollapsed(prev=> ({...prev, [v.id]: !isCollapsed}))}>
                    <div style={{fontWeight:700}}>🎬 {v.title || 'Untitled Video'}</div>
                    <div className="meta">
                      <span className="pill">{scripts.length} Scripts</span>
                      <span className="pill">{thumbs.length} Thumbs</span>
                      <span className="pill">{heads.length} Headlines</span>
                      <span>{isCollapsed ? '▸' : '▾'}</span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="card-content">
                      <div className="meta" style={{marginBottom:10}}>
                        <button className="btn" onClick={()=> setEditingItem(v)}>✏️ Edit</button>
                        <button className="btn" onClick={()=> removeItem(v.id)}>🗑️ Delete</button>
                      </div>
                      <Section label="Scripts" data={scripts} type="script" />
                      <Section label="Thumbnails" data={thumbs} type="thumbnail" />
                      <Section label="Headlines" data={heads} type="headline" />
                      <div className="footer">
                        <span>Updated {fmt(v.updatedAt || v.createdAt)}</span>
                        <span>ID: {v.id.slice(-6)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{border:'1px dashed var(--stroke2)',padding:24,borderRadius:12,color:'var(--muted)',textAlign:'center'}}>No videos yet. Click <b>➕ New Video</b> to start a project.</div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

       {editingItem && (
        <div className="modal" onClick={(e)=>{ if(e.target===e.currentTarget) setEditingItem(null); }}>
          <div className="modal-card">
            <div className="modal-h">Edit {editingItem.type}</div>
            <div className="modal-b">
              <div className="field"><input type="text" value={editingItem.title} onChange={(e)=> setEditingItem({...editingItem, title: e.target.value})} placeholder="Title" /></div>
              <div className="field">
                <select value={editingItem.status} onChange={(e)=> setEditingItem({...editingItem, status: e.target.value})}>
                  <option value="idea">idea</option>
                  <option value="draft">draft</option>
                  <option value="final">final</option>
                </select>
              </div>
              <div className="field"><input type="text" value={(editingItem.tags||[]).join(", ")} onChange={(e)=> setEditingItem({...editingItem, tags: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} placeholder="tags, comma, separated" /></div>
              <div className="field"><textarea rows={6} value={editingItem.content} onChange={(e)=> setEditingItem({...editingItem, content: e.target.value})} placeholder={editingItem.type==='headline' ? 'Headline text' : 'Notes / Script content'} /></div>

              {editingItem.type === 'script' && (
                <div>
                  <div className="sectionHead" onClick={()=> setEditingItem({...editingItem, hookCollapsed: !editingItem.hookCollapsed})}>
                    <span>{editingItem.hookCollapsed ? '▸' : '▾'} Hook / Intro</span>
                  </div>
                  {!editingItem.hookCollapsed && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'10px'}}>
                      <div className="field">
                        <label>Planning</label>
                        <textarea rows={4} value={editingItem.hookPlanning || ''} onChange={(e)=> setEditingItem({...editingItem, hookPlanning: e.target.value})} />
                      </div>
                      <div className="field">
                        <label>Content</label>
                        <textarea rows={4} value={editingItem.hookContent || ''} onChange={(e)=> setEditingItem({...editingItem, hookContent: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {editingItem.type === 'script' && (
                <div>
                  <div className="sectionHead" onClick={()=> setEditingItem({...editingItem, sectionCollapsed: !editingItem.sectionCollapsed})}>
                    <span>{editingItem.sectionCollapsed ? '▸' : '▾'} Section 1</span>
                  </div>
                  {!editingItem.sectionCollapsed && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'10px'}}>
                      <div className="field">
                        <label>Planning</label>
                        <textarea rows={4} value={editingItem.sectionPlanning || ''} onChange={(e)=> setEditingItem({...editingItem, sectionPlanning: e.target.value})} />
                      </div>
                      <div className="field">
                        <label>Content</label>
                        <textarea rows={4} value={editingItem.sectionContent || ''} onChange={(e)=> setEditingItem({...editingItem, sectionContent: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
            <div className="modal-b" style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn" onClick={()=> setEditingItem(null)}>Cancel</button>
              <button className="btn primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
