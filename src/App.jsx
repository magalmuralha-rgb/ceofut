import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY = "ceofut:v2";
const PLAYER_KEY = "ceofut:player:v2";
const APP_URL = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_URL || "";
const CEO_EMAILS = (import.meta.env.VITE_CEO_EMAILS || "magalmuralha@gmail.com,magalmuralha.rgb@gmail.com,magalmuralha-rgb@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;

const MODALIDADES = {
  salao: { label: "Futsal", teamSize: 5, badge: "5 por lado" },
  society: { label: "Society", teamSize: 7, badge: "7 por lado" },
  campo: { label: "Campo", teamSize: 11, badge: "11 por lado" },
};

const POSICOES = ["Goleiro", "Zagueiro", "Lateral", "Volante", "Meia", "Ponta", "Atacante"];

function emptyState() {
  return {
    ceo: { nome: "", email: "", subscribed: false, pixKey: "" },
    matches: [],
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.ceo && Array.isArray(saved.matches)) return saved;
  } catch {}
  return emptyState();
}

function saveState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  if (supabase) {
    supabase.from("ceofut_snapshots").upsert({
      id: "default",
      data: next,
      updated_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});
  }
}

function getInviteCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("convite") || params.get("jogo");
}

function App() {
  const [state, setState] = useState(loadState);
  const initialInviteCode = getInviteCode();
  const initialMatch = initialInviteCode
    ? state.matches.find((match) => match.codigo === initialInviteCode || match.id === initialInviteCode)
    : state.matches[0];
  const [activeId, setActiveId] = useState(initialMatch?.id || "");
  const [view, setView] = useState(initialInviteCode ? "invite" : "dashboard");
  const [toast, setToast] = useState("");
  const [loadingCloud, setLoadingCloud] = useState(!!supabase);

  const activeMatch = state.matches.find((match) => match.id === activeId) || state.matches[0];
  const isAuthorizedCeo = state.ceo.subscribed || CEO_EMAILS.includes((state.ceo.email || "").trim().toLowerCase());
  const ceoReady = state.ceo.nome && state.ceo.email && isAuthorizedCeo;

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase
      .from("ceofut_snapshots")
      .select("data")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data?.data?.ceo && Array.isArray(data.data.matches)) {
          setState(data.data);
          const code = getInviteCode();
          if (code) {
            const remoteMatch = data.data.matches.find((match) => match.codigo === code || match.id === code);
            if (remoteMatch) setActiveId(remoteMatch.id);
          } else if (!activeId && data.data.matches[0]) {
            setActiveId(data.data.matches[0].id);
          }
        }
      })
      .finally(() => alive && setLoadingCloud(false));
    return () => { alive = false; };
  }, []);

  function updateState(fn) {
    setState((current) => {
      const next = fn(current);
      saveState(next);
      return next;
    });
  }

  function updateMatch(id, fn) {
    updateState((current) => ({
      ...current,
      matches: current.matches.map((match) => match.id === id ? fn(match) : match),
    }));
  }

  async function copyInvite(match) {
    const text = inviteMessage(match);
    await navigator.clipboard?.writeText(text);
    setToast("Convite pronto para WhatsApp copiado.");
    setTimeout(() => setToast(""), 2400);
  }

  function createMatch(payload) {
    const match = {
      id: crypto.randomUUID().slice(0, 8),
      codigo: makeCode(),
      ...payload,
      pixKey: payload.pixKey || state.ceo.pixKey || "",
      valor: Number(payload.valor || 0),
      players: [],
      teams: [],
      locked: false,
      observacao: payload.observacao || "",
    };
    updateState((current) => ({ ...current, matches: [match, ...current.matches] }));
    setActiveId(match.id);
  }

  return (
    <div className="app-shell">
      <Header
        ceo={state.ceo}
        isAuthorized={isAuthorizedCeo}
        onHome={() => { setView("dashboard"); setActiveId(state.matches[0]?.id || ""); }}
        onProfile={() => setView("profile")}
      />
      <main>
        {loadingCloud ? (
          <section className="invite">
            <div className="invite-card tactical-board">
              <span className="pill">CEOFut</span>
              <h1>Carregando pelada</h1>
              <p>Buscando dados em campo...</p>
            </div>
          </section>
        ) : view === "invite" ? (
          activeMatch ? (
            <InvitePage
              match={activeMatch}
              onBack={() => setView("dashboard")}
              onConfirm={(athlete) => updateMatch(activeMatch.id, (match) => upsertPlayer(match, athlete))}
            />
          ) : <InviteMissing />
        ) : !ceoReady ? (
          <Onboarding
            ceo={state.ceo}
            isAuthorized={isAuthorizedCeo}
            onSave={(ceo) => updateState((s) => ({ ...s, ceo }))}
          />
        ) : view === "profile" ? (
          <Profile
            ceo={state.ceo}
            isAuthorized={isAuthorizedCeo}
            onSave={(ceo) => updateState((s) => ({ ...s, ceo }))}
          />
        ) : (
          <Dashboard
            state={state}
            activeMatch={activeMatch}
            onSelect={(id) => setActiveId(id)}
            onCreate={createMatch}
            onCopy={copyInvite}
            onUpdateMatch={updateMatch}
          />
        )}
      </main>
      {toast && <div className="toast">{toast}</div>}
      <footer>
        <strong>CEO Group</strong>
        <span>Desenvolvido pelo CEO Group.</span>
      </footer>
    </div>
  );
}

function Header({ ceo, isAuthorized, onHome, onProfile }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome}>
        <span className="ball-mark">CF</span>
        <span>
          <strong>CEOFut</strong>
          <small>{isAuthorized ? "painel do CEO" : "organizador de futebol"}</small>
        </span>
      </button>
      <button className="icon-btn" onClick={onProfile} title="Perfil do CEO">
        {ceo?.nome ? ceo.nome.slice(0, 1).toUpperCase() : "C"}
      </button>
    </header>
  );
}

function Onboarding({ ceo, isAuthorized, onSave }) {
  const [form, setForm] = useState(ceo);
  const allowed = form.subscribed || CEO_EMAILS.includes((form.email || "").trim().toLowerCase());

  return (
    <section className="hero">
      <div className="hero-copy tactical-board">
        <p className="eyebrow">CEO Group apresenta</p>
        <h1>CEOFut</h1>
        <p>Convite por codigo, confirmacao da pelada, controle de Pix e sorteio inteligente por nota e posicao.</p>
      </div>
      <div className="panel compact login-card">
        <span className="pill dark">Acesso do organizador</span>
        <h2>Entrar como CEO</h2>
        <label>Seu nome</label>
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Magal" />
        <label>E-mail cadastrado</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" />
        <label>Chave Pix padrao</label>
        <input value={form.pixKey || ""} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} placeholder="CPF, telefone, email ou chave aleatoria" />
        {!allowed && form.email && (
          <div className="access-warning">
            Este e-mail ainda nao esta liberado como CEO. Assine ou adicione em VITE_CEO_EMAILS.
          </div>
        )}
        <button
          className="primary full"
          disabled={!form.nome || !form.email || !allowed}
          onClick={() => onSave({ ...form, subscribed: form.subscribed || isAuthorized })}
        >
          Abrir painel
        </button>
        <CheckoutBlock email={form.email} />
      </div>
    </section>
  );
}

function CheckoutBlock({ email }) {
  function goCheckout() {
    if (!CHECKOUT_URL) {
      alert("Configure VITE_CHECKOUT_URL no Vercel para ativar a venda do CEOFut.");
      return;
    }
    const url = new URL(CHECKOUT_URL);
    if (email) url.searchParams.set("email", email);
    window.location.href = url.toString();
  }

  return (
    <div className="price-box">
      <div>
        <strong>Plano CEOFut</strong>
        <span>Ative venda via Mercado Pago quando o checkout estiver pronto.</span>
      </div>
      <button className="ghost invert" onClick={goCheckout}>Assinar</button>
    </div>
  );
}

function Profile({ ceo, isAuthorized, onSave }) {
  const [form, setForm] = useState(ceo);
  return (
    <section className="narrow">
      <div className="panel">
        <span className="pill">{isAuthorized ? "CEO liberado" : "Aguardando assinatura"}</span>
        <h2>Perfil do CEO</h2>
        <label>Nome</label>
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <label>E-mail</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Chave Pix padrao</label>
        <input value={form.pixKey || ""} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} />
        <label className="check-row">
          <input type="checkbox" checked={!!form.subscribed} onChange={(e) => setForm({ ...form, subscribed: e.target.checked })} />
          Acesso CEO ativo
        </label>
        <button className="primary" onClick={() => onSave(form)}>Salvar perfil</button>
      </div>
    </section>
  );
}

function Dashboard({ state, activeMatch, onSelect, onCreate, onCopy, onUpdateMatch }) {
  return (
    <section className="dashboard">
      <aside className="sidebar">
        <NewMatchForm ceo={state.ceo} onCreate={onCreate} />
        <div className="match-list">
          {state.matches.length === 0 && (
            <div className="empty-side">Crie sua primeira pelada para gerar o codigo de convite.</div>
          )}
          {state.matches.map((match) => (
            <button
              key={match.id}
              className={match.id === activeMatch?.id ? "match-item active" : "match-item"}
              onClick={() => onSelect(match.id)}
            >
              <strong>{match.nome}</strong>
              <span>{match.codigo} - {MODALIDADES[match.modalidade].label} - {formatDate(match.data)} - {match.hora}</span>
            </button>
          ))}
        </div>
      </aside>
      {activeMatch ? (
        <MatchPanel
          match={activeMatch}
          onCopy={() => onCopy(activeMatch)}
          onUpdate={(fn) => onUpdateMatch(activeMatch.id, fn)}
        />
      ) : (
        <div className="content">
          <div className="empty-state tactical-board">
            <span className="pill">Prancheta limpa</span>
            <h1>Nenhuma pelada criada</h1>
            <p>Comece pelo botao "Nova pelada". O CEO gera um codigo e os convidados entram apenas pelo link.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function NewMatchForm({ ceo, onCreate }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    modalidade: "society",
    data: new Date().toISOString().slice(0, 10),
    hora: "20:00",
    local: "",
    valor: "",
    pixKey: ceo.pixKey || "",
    observacao: "",
  });

  function submit() {
    if (!form.nome || !form.local) return;
    onCreate(form);
    setOpen(false);
    setForm({ ...form, nome: "", local: "", valor: "", observacao: "" });
  }

  if (!open) return <button className="primary full" onClick={() => setOpen(true)}>+ Nova pelada</button>;

  return (
    <div className="panel form-panel">
      <h2>Nova pelada</h2>
      <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome da pelada" />
      <select value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value })}>
        {Object.entries(MODALIDADES).map(([key, item]) => <option key={key} value={key}>{item.label} ({item.badge})</option>)}
      </select>
      <div className="two">
        <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
      </div>
      <input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Local" />
      <div className="two">
        <input type="number" min="0" step="1" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Valor por jogador" />
        <input value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} placeholder="Chave Pix do CEO" />
      </div>
      <textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Observacoes" />
      <div className="actions">
        <button className="ghost" onClick={() => setOpen(false)}>Cancelar</button>
        <button className="primary" onClick={submit}>Criar e gerar codigo</button>
      </div>
    </div>
  );
}

function MatchPanel({ match, onCopy, onUpdate }) {
  const confirmed = match.players.filter((p) => p.status === "vai");
  const declined = match.players.filter((p) => p.status === "nao");
  const pending = match.players.filter((p) => p.status === "pendente");
  const paid = confirmed.filter((p) => p.paid).length;
  const avg = confirmed.length ? confirmed.reduce((sum, p) => sum + Number(p.nota || 0), 0) / confirmed.length : 0;
  const inviteUrl = `${APP_URL}?convite=${match.codigo}`;

  function addManual(playerData) {
    onUpdate((current) => upsertPlayer(current, playerData));
  }

  function updatePlayer(id, patch) {
    onUpdate((current) => ({
      ...current,
      players: current.players.map((p) => p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p),
      teams: current.locked ? current.teams : [],
    }));
  }

  function drawTeams() {
    onUpdate((current) => current.locked ? current : { ...current, teams: balanceTeams(current) });
  }

  function toggleLock() {
    onUpdate((current) => ({ ...current, locked: !current.locked }));
  }

  function movePlayer(playerId, targetTeamId) {
    onUpdate((current) => current.locked ? current : movePlayerBetweenTeams(current, playerId, targetTeamId));
  }

  return (
    <div className="content">
      <div className="match-hero tactical-board">
        <div>
          <span className="pill">{match.codigo} - {MODALIDADES[match.modalidade].label} - {MODALIDADES[match.modalidade].badge}</span>
          <h1>{match.nome}</h1>
          <p>{formatDate(match.data)} as {match.hora} - {match.local}</p>
          <small>Convite: {inviteUrl}</small>
          {match.pixKey && <small>Pix do CEO: {match.pixKey}{match.valor ? ` - R$ ${Number(match.valor).toFixed(2).replace(".", ",")}` : ""}</small>}
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={onCopy}>Copiar WhatsApp</button>
          <a className="whats" href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(match))}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
        </div>
      </div>

      <div className="stats-grid">
        <Stat label="Confirmados" value={confirmed.length} />
        <Stat label="Pagos" value={`${paid}/${confirmed.length}`} />
        <Stat label="Pendentes" value={pending.length} />
        <Stat label="Nota media" value={avg.toFixed(1)} />
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-title">
            <h2>Atletas</h2>
            <span>{match.players.length} cadastrados</span>
          </div>
          <PaymentConfig match={match} onUpdate={onUpdate} />
          <AddPlayer onAdd={addManual} />
          <PlayerTable players={match.players} onUpdate={updatePlayer} />
          {declined.length > 0 && <p className="muted">{declined.length} jogador(es) marcaram que nao vao.</p>}
        </div>
        <div className="panel draw-panel">
          <div className="panel-title">
            <h2>Sorteio</h2>
            <span>{match.locked ? "travado" : MODALIDADES[match.modalidade].badge}</span>
          </div>
          <div className="draw-actions">
            <button className="primary full" disabled={confirmed.length < 2 || match.locked} onClick={drawTeams}>
              {match.teams?.length ? "Sortear novamente" : "Sortear times inteligentes"}
            </button>
            <button className="ghost full" disabled={!match.teams?.length} onClick={toggleLock}>
              {match.locked ? "Destravar sorteio" : "Travar sorteio"}
            </button>
          </div>
          <TeamResult
            teams={match.teams}
            modalidade={match.modalidade}
            editable={!match.locked}
            onMove={movePlayer}
          />
        </div>
      </div>
    </div>
  );
}

function PaymentConfig({ match, onUpdate }) {
  return (
    <div className="payment-config">
      <input
        value={match.pixKey || ""}
        onChange={(e) => onUpdate((current) => ({ ...current, pixKey: e.target.value }))}
        placeholder="Chave Pix desta pelada"
      />
      <input
        type="number"
        min="0"
        step="1"
        value={match.valor || ""}
        onChange={(e) => onUpdate((current) => ({ ...current, valor: Number(e.target.value || 0) }))}
        placeholder="Valor"
      />
    </div>
  );
}

function AddPlayer({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", phone: "", nota: 7, posicoes: [], status: "vai", paid: false });
  const valid = form.nome.trim().length > 1 && form.posicoes.length >= 3;

  function togglePos(pos) {
    setForm((current) => ({
      ...current,
      posicoes: current.posicoes.includes(pos)
        ? current.posicoes.filter((p) => p !== pos)
        : [...current.posicoes, pos].slice(0, 3),
    }));
  }

  function submit() {
    if (!valid) return;
    onAdd({ ...form, id: crypto.randomUUID(), updatedAt: Date.now() });
    setForm({ nome: "", phone: "", nota: 7, posicoes: [], status: "vai", paid: false });
    setOpen(false);
  }

  if (!open) return <button className="ghost full" onClick={() => setOpen(true)}>+ Adicionar atleta</button>;

  return (
    <div className="mini-form">
      <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do atleta" />
      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp opcional" />
      <label>Nota: {form.nota}</label>
      <input type="range" min="1" max="10" step="0.5" value={form.nota} onChange={(e) => setForm({ ...form, nota: Number(e.target.value) })} />
      <PositionPicker selected={form.posicoes} onToggle={togglePos} />
      <label className="check-row">
        <input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} />
        Ja pagou
      </label>
      <div className="actions">
        <button className="ghost" onClick={() => setOpen(false)}>Fechar</button>
        <button className="primary" disabled={!valid} onClick={submit}>Salvar atleta</button>
      </div>
    </div>
  );
}

function PlayerTable({ players, onUpdate }) {
  if (!players.length) return <p className="muted">Base limpa. Copie o convite e chame os atletas pelo WhatsApp.</p>;
  return (
    <div className="player-list">
      {players.map((p) => (
        <div className="player-row" key={p.id}>
          <div>
            <strong>{p.nome}</strong>
            <span>{p.posicoes.join(" - ") || "sem posicoes"}</span>
          </div>
          <select value={p.status} onChange={(e) => onUpdate(p.id, { status: e.target.value })}>
            <option value="vai">Vai</option>
            <option value="pendente">Pendente</option>
            <option value="nao">Nao vai</option>
          </select>
          <input type="number" min="1" max="10" step="0.5" value={p.nota} onChange={(e) => onUpdate(p.id, { nota: Number(e.target.value) })} />
          <label className={p.paid ? "paid-toggle paid" : "paid-toggle"}>
            <input type="checkbox" checked={!!p.paid} onChange={(e) => onUpdate(p.id, { paid: e.target.checked })} />
            {p.paid ? "Pago" : "Pix"}
          </label>
        </div>
      ))}
    </div>
  );
}

function InvitePage({ match, onBack, onConfirm }) {
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(PLAYER_KEY) || "null") || {}; } catch { return {}; }
  }, []);
  const [form, setForm] = useState({
    id: saved.id || crypto.randomUUID(),
    nome: saved.nome || "",
    phone: saved.phone || "",
    nota: saved.nota || 7,
    posicoes: saved.posicoes || [],
    status: "vai",
    paid: false,
  });
  const [done, setDone] = useState(false);
  const valid = form.nome.trim().length > 1 && form.posicoes.length >= 3;

  function togglePos(pos) {
    setForm((current) => ({
      ...current,
      posicoes: current.posicoes.includes(pos)
        ? current.posicoes.filter((p) => p !== pos)
        : [...current.posicoes, pos].slice(0, 3),
    }));
  }

  function confirm(status) {
    const athlete = { ...form, status, updatedAt: Date.now() };
    localStorage.setItem(PLAYER_KEY, JSON.stringify(athlete));
    onConfirm(athlete);
    setDone(true);
  }

  return (
    <section className="invite">
      <div className="invite-card tactical-board">
        <span className="pill">{match.codigo} - {MODALIDADES[match.modalidade].label}</span>
        <h1>{match.nome}</h1>
        <p>{formatDate(match.data)} as {match.hora} - {match.local}</p>
        {match.pixKey && <div className="pix-box">Pix: {match.pixKey}{match.valor ? ` - R$ ${Number(match.valor).toFixed(2).replace(".", ",")}` : ""}</div>}
        {match.teams?.length > 0 && (
          <div className="public-draw">
            <div className="panel-title">
              <h2>Times sorteados</h2>
              <span>{match.locked ? "travado pelo CEO" : "preliminar"}</span>
            </div>
            <TeamResult teams={match.teams} modalidade={match.modalidade} />
          </div>
        )}
        {done ? (
          <div className="success">
            <h2>Resposta salva</h2>
            <p>Seu cadastro ficou salvo neste aparelho para as proximas peladas.</p>
            <button className="primary" onClick={onBack}>Voltar</button>
          </div>
        ) : (
          <>
            <label>Seu nome</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Como a galera te chama" />
            <label>WhatsApp</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="opcional" />
            <label>Sua autoavaliacao: {form.nota}</label>
            <input type="range" min="1" max="10" step="0.5" value={form.nota} onChange={(e) => setForm({ ...form, nota: Number(e.target.value) })} />
            <PositionPicker selected={form.posicoes} onToggle={togglePos} />
            <div className="actions">
              <button className="ghost" disabled={!form.nome} onClick={() => confirm("nao")}>Nao vou</button>
              <button className="primary" disabled={!valid} onClick={() => confirm("vai")}>Confirmar presenca</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function InviteMissing() {
  return (
    <section className="invite">
      <div className="invite-card">
        <span className="pill">Convite</span>
        <h1>Codigo nao encontrado</h1>
        <p>Peça ao CEO o link atualizado da pelada.</p>
      </div>
    </section>
  );
}

function PositionPicker({ selected, onToggle }) {
  return (
    <div>
      <label>Escolha 3 posicoes por preferencia</label>
      <div className="chips">
        {POSICOES.map((pos) => (
          <button
            type="button"
            key={pos}
            className={selected.includes(pos) ? "chip active" : "chip"}
            onClick={() => onToggle(pos)}
          >
            {selected.indexOf(pos) >= 0 ? `${selected.indexOf(pos) + 1}. ` : ""}{pos}
          </button>
        ))}
      </div>
    </div>
  );
}

function TeamResult({ teams, modalidade, editable = false, onMove }) {
  if (!teams?.length) return <p className="muted">Os times sorteados aparecem aqui. Times incompletos tambem sao aceitos.</p>;
  return (
    <div className="teams">
      {teams.map((team, index) => (
        <div className="team" key={team.id}>
          <div className="team-head">
            <strong>Time {index + 1}</strong>
            <span>forca {team.score.toFixed(1)}</span>
          </div>
          {team.players.map((p) => (
            <div className="team-player" key={p.id}>
              <div>
                <span>{p.nome}</span>
                <small>{p.assignedPosition || p.posicoes[0]} - {p.nota}</small>
              </div>
              {editable && onMove ? (
                <select value={team.id} onChange={(e) => onMove(p.id, e.target.value)} aria-label={`Mover ${p.nome}`}>
                  {teams.map((target, targetIndex) => (
                    <option key={target.id} value={target.id}>Time {targetIndex + 1}</option>
                  ))}
                </select>
              ) : null}
            </div>
          ))}
          <small className="capacity">{team.players.length}/{MODALIDADES[modalidade].teamSize}</small>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function upsertPlayer(match, athlete) {
  const existing = match.players.find((p) => p.id === athlete.id || normalize(p.nome) === normalize(athlete.nome));
  const players = existing
    ? match.players.map((p) => p.id === existing.id ? { ...p, ...athlete, id: existing.id, paid: p.paid || athlete.paid } : p)
    : [...match.players, athlete];
  return { ...match, players, teams: match.locked ? match.teams : [] };
}

function movePlayerBetweenTeams(match, playerId, targetTeamId) {
  if (!match.teams?.length) return match;
  const moving = match.teams.flatMap((team) => team.players).find((player) => player.id === playerId);
  if (!moving) return match;
  const teams = match.teams.map((team) => ({
    ...team,
    players: team.players.filter((player) => player.id !== playerId),
  })).map((team) => (
    team.id === targetTeamId ? { ...team, players: [...team.players, moving] } : team
  ));
  return { ...match, teams: recalcTeamScores(teams) };
}

function recalcTeamScores(teams) {
  return teams.map((team) => ({
    ...team,
    score: team.players.reduce((sum, player) => sum + Number(player.nota || 0), 0),
  }));
}

function balanceTeams(match) {
  const confirmed = match.players
    .filter((p) => p.status === "vai")
    .map((p) => ({ ...p, nota: Number(p.nota || 5) }))
    .sort((a, b) => b.nota - a.nota);

  if (confirmed.length < 2) return [];

  const teamSize = MODALIDADES[match.modalidade].teamSize;
  const teamCount = Math.max(2, Math.ceil(confirmed.length / teamSize));
  const teams = Array.from({ length: teamCount }, (_, i) => ({ id: `team-${i}`, score: 0, players: [], positions: {} }));

  for (const athlete of confirmed) {
    const ranked = teams
      .filter((team) => team.players.length < teamSize)
      .map((team) => {
        const preferred = athlete.posicoes || [];
        const positionPenalty = preferred.reduce((sum, pos, index) => sum + ((team.positions[pos] || 0) * (3 - index)), 0);
        const sizePenalty = team.players.length * 0.35;
        return { team, weight: team.score + positionPenalty * 0.8 + sizePenalty };
      })
      .sort((a, b) => a.weight - b.weight);
    const target = ranked[0].team;
    const assignedPosition = choosePosition(target, athlete.posicoes || []);
    target.players.push({ ...athlete, assignedPosition });
    target.score += athlete.nota;
    target.positions[assignedPosition] = (target.positions[assignedPosition] || 0) + 1;
  }

  return teams.map(({ positions, ...team }) => team);
}

function choosePosition(team, preferences) {
  if (!preferences.length) return "Livre";
  return [...preferences].sort((a, b) => (team.positions[a] || 0) - (team.positions[b] || 0))[0];
}

function inviteMessage(match) {
  const url = `${APP_URL}?convite=${match.codigo}`;
  const valor = match.valor ? `\nValor: R$ ${Number(match.valor).toFixed(2).replace(".", ",")}` : "";
  const pix = match.pixKey ? `\nPix: ${match.pixKey}` : "";
  return `CEOFut - ${match.nome}\nCodigo: ${match.codigo}\n${formatDate(match.data)} as ${match.hora}\nLocal: ${match.local}${valor}${pix}\nConfirme aqui: ${url}`;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `FUT-${code}`;
}

function normalize(value) {
  return (value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDate(value) {
  if (!value) return "sem data";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default App;
