import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY = "ceofut:v1";
const PLAYER_KEY = "ceofut:player";
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_URL || "";
const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;

const MODALIDADES = {
  salao: { label: "Futsal", teamSize: 5, badge: "5x5" },
  society: { label: "Society", teamSize: 7, badge: "7x7" },
  campo: { label: "Campo", teamSize: 11, badge: "11x11" },
};

const POSICOES = [
  "Goleiro",
  "Zagueiro",
  "Lateral",
  "Volante",
  "Meia",
  "Ponta",
  "Atacante",
];

const seedMatches = [
  {
    id: "demo",
    nome: "Quinta do CEO",
    modalidade: "society",
    data: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    hora: "20:30",
    local: "Arena CEO",
    observacao: "Chegar 15 min antes para dividir colete e aquecer.",
    players: [
      player("Bruno", 8.5, ["Meia", "Ponta", "Atacante"], "vai"),
      player("Caio", 7.8, ["Zagueiro", "Volante", "Lateral"], "vai"),
      player("Dudu", 9.1, ["Atacante", "Ponta", "Meia"], "vai"),
      player("Felipe", 6.9, ["Lateral", "Volante", "Zagueiro"], "vai"),
      player("Gui", 7.4, ["Goleiro", "Zagueiro", "Volante"], "vai"),
      player("Léo", 8.0, ["Meia", "Volante", "Ponta"], "vai"),
      player("Matheus", 6.5, ["Zagueiro", "Lateral", "Volante"], "pendente"),
      player("Rafa", 8.7, ["Ponta", "Atacante", "Meia"], "vai"),
    ],
    teams: [],
  },
];

function player(nome, nota, posicoes, status = "pendente") {
  return { id: crypto.randomUUID(), nome, nota, posicoes, status, phone: "", updatedAt: Date.now() };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.matches?.length) return saved;
  } catch {}
  return { ceo: { nome: "", email: "", subscribed: false }, matches: seedMatches };
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

function getInviteMatchId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("jogo");
}

function App() {
  const [state, setState] = useState(loadState);
  const [activeId, setActiveId] = useState(getInviteMatchId() || state.matches[0]?.id || "");
  const [view, setView] = useState(getInviteMatchId() ? "invite" : "dashboard");
  const [toast, setToast] = useState("");

  const activeMatch = state.matches.find((m) => m.id === activeId) || state.matches[0];
  const ceoReady = state.ceo.nome && state.ceo.email;

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

  function copyInvite(match) {
    const url = `${APP_URL}?jogo=${match.id}`;
    navigator.clipboard?.writeText(url);
    setToast("Link do futebol copiado.");
    setTimeout(() => setToast(""), 2200);
  }

  function createMatch(payload) {
    const match = {
      id: crypto.randomUUID().slice(0, 8),
      ...payload,
      players: [],
      teams: [],
      observacao: payload.observacao || "",
    };
    updateState((current) => ({ ...current, matches: [match, ...current.matches] }));
    setActiveId(match.id);
  }

  return (
    <div className="app-shell">
      <Header
        ceo={state.ceo}
        onHome={() => { setView("dashboard"); setActiveId(state.matches[0]?.id || ""); }}
        onProfile={() => setView("profile")}
      />
      <main>
        {!ceoReady && view !== "invite" ? (
          <Onboarding
            ceo={state.ceo}
            onSave={(ceo) => updateState((s) => ({ ...s, ceo }))}
          />
        ) : view === "invite" && activeMatch ? (
          <InvitePage
            match={activeMatch}
            onBack={() => setView("dashboard")}
            onConfirm={(athlete) => updateMatch(activeMatch.id, (match) => upsertPlayer(match, athlete))}
          />
        ) : view === "profile" ? (
          <Profile
            ceo={state.ceo}
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

function Header({ ceo, onHome, onProfile }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome}>
        <span className="ball-mark">CF</span>
        <span>
          <strong>CEOFut</strong>
          <small>organizador de futebol</small>
        </span>
      </button>
      <button className="icon-btn" onClick={onProfile} title="Perfil do CEO">
        {ceo?.nome ? ceo.nome.slice(0, 1).toUpperCase() : "C"}
      </button>
    </header>
  );
}

function Onboarding({ ceo, onSave }) {
  const [form, setForm] = useState(ceo);
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">CEO Group apresenta</p>
        <h1>CEOFut</h1>
        <p>Convide a galera, confirme presença e sorteie times equilibrados por nota e posição.</p>
      </div>
      <div className="panel compact">
        <h2>Comece como CEO</h2>
        <label>Seu nome</label>
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Magal" />
        <label>E-mail</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" />
        <button className="primary" onClick={() => onSave({ ...form, subscribed: form.subscribed || false })}>Entrar no painel</button>
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
        <span>Venda pronta para plugar no Mercado Pago.</span>
      </div>
      <button className="ghost" onClick={goCheckout}>Assinar</button>
    </div>
  );
}

function Profile({ ceo, onSave }) {
  const [form, setForm] = useState(ceo);
  return (
    <section className="narrow">
      <div className="panel">
        <h2>Perfil do CEO</h2>
        <label>Nome</label>
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <label>E-mail</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
        <NewMatchForm onCreate={onCreate} />
        <div className="match-list">
          {state.matches.map((match) => (
            <button
              key={match.id}
              className={match.id === activeMatch?.id ? "match-item active" : "match-item"}
              onClick={() => onSelect(match.id)}
            >
              <strong>{match.nome}</strong>
              <span>{MODALIDADES[match.modalidade].label} · {formatDate(match.data)} · {match.hora}</span>
            </button>
          ))}
        </div>
      </aside>
      {activeMatch && (
        <MatchPanel
          match={activeMatch}
          onCopy={() => onCopy(activeMatch)}
          onUpdate={(fn) => onUpdateMatch(activeMatch.id, fn)}
        />
      )}
    </section>
  );
}

function NewMatchForm({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    modalidade: "society",
    data: new Date().toISOString().slice(0, 10),
    hora: "20:00",
    local: "",
    observacao: "",
  });

  function submit() {
    if (!form.nome || !form.local) return;
    onCreate(form);
    setOpen(false);
    setForm({ ...form, nome: "", local: "", observacao: "" });
  }

  if (!open) return <button className="primary full" onClick={() => setOpen(true)}>+ Novo futebol</button>;

  return (
    <div className="panel form-panel">
      <h2>Novo futebol</h2>
      <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do jogo" />
      <select value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value })}>
        {Object.entries(MODALIDADES).map(([key, item]) => <option key={key} value={key}>{item.label} ({item.badge})</option>)}
      </select>
      <div className="two">
        <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
      </div>
      <input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Local" />
      <textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Observações" />
      <div className="actions">
        <button className="ghost" onClick={() => setOpen(false)}>Cancelar</button>
        <button className="primary" onClick={submit}>Criar</button>
      </div>
    </div>
  );
}

function MatchPanel({ match, onCopy, onUpdate }) {
  const confirmed = match.players.filter((p) => p.status === "vai");
  const declined = match.players.filter((p) => p.status === "nao");
  const pending = match.players.filter((p) => p.status === "pendente");
  const avg = confirmed.length ? confirmed.reduce((sum, p) => sum + Number(p.nota || 0), 0) / confirmed.length : 0;

  function addManual(playerData) {
    onUpdate((current) => upsertPlayer(current, playerData));
  }

  function updatePlayer(id, patch) {
    onUpdate((current) => ({
      ...current,
      players: current.players.map((p) => p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p),
      teams: [],
    }));
  }

  function drawTeams() {
    onUpdate((current) => ({ ...current, teams: balanceTeams(current) }));
  }

  return (
    <div className="content">
      <div className="match-hero">
        <div>
          <span className="pill">{MODALIDADES[match.modalidade].label} · {MODALIDADES[match.modalidade].badge}</span>
          <h1>{match.nome}</h1>
          <p>{formatDate(match.data)} às {match.hora} · {match.local}</p>
          {match.observacao && <small>{match.observacao}</small>}
        </div>
        <button className="primary" onClick={onCopy}>Copiar link</button>
      </div>

      <div className="stats-grid">
        <Stat label="Confirmados" value={confirmed.length} />
        <Stat label="Pendentes" value={pending.length} />
        <Stat label="Fora" value={declined.length} />
        <Stat label="Nota média" value={avg.toFixed(1)} />
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-title">
            <h2>Atletas</h2>
            <span>{match.players.length} cadastrados</span>
          </div>
          <AddPlayer onAdd={addManual} />
          <PlayerTable players={match.players} onUpdate={updatePlayer} />
        </div>
        <div className="panel draw-panel">
          <div className="panel-title">
            <h2>Sorteio</h2>
            <span>nota + posições</span>
          </div>
          <button className="primary full" disabled={confirmed.length < 2} onClick={drawTeams}>Sortear times</button>
          <TeamResult teams={match.teams} modalidade={match.modalidade} />
        </div>
      </div>
    </div>
  );
}

function AddPlayer({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", phone: "", nota: 7, posicoes: [], status: "vai" });
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
    setForm({ nome: "", phone: "", nota: 7, posicoes: [], status: "vai" });
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
      <div className="actions">
        <button className="ghost" onClick={() => setOpen(false)}>Fechar</button>
        <button className="primary" disabled={!valid} onClick={submit}>Salvar atleta</button>
      </div>
    </div>
  );
}

function PlayerTable({ players, onUpdate }) {
  if (!players.length) return <p className="muted">Nenhum atleta ainda. Copie o link e chame a galera.</p>;
  return (
    <div className="player-list">
      {players.map((p) => (
        <div className="player-row" key={p.id}>
          <div>
            <strong>{p.nome}</strong>
            <span>{p.posicoes.join(" · ") || "sem posições"}</span>
          </div>
          <select value={p.status} onChange={(e) => onUpdate(p.id, { status: e.target.value })}>
            <option value="vai">Vai</option>
            <option value="pendente">Pendente</option>
            <option value="nao">Não vai</option>
          </select>
          <input type="number" min="1" max="10" step="0.5" value={p.nota} onChange={(e) => onUpdate(p.id, { nota: Number(e.target.value) })} />
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
      <div className="invite-card">
        <span className="pill">{MODALIDADES[match.modalidade].label}</span>
        <h1>{match.nome}</h1>
        <p>{formatDate(match.data)} às {match.hora} · {match.local}</p>
        {done ? (
          <div className="success">
            <h2>Resposta salva</h2>
            <p>Seu cadastro ficou salvo neste aparelho para os próximos futs.</p>
            <button className="primary" onClick={onBack}>Voltar</button>
          </div>
        ) : (
          <>
            <label>Seu nome</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Como a galera te chama" />
            <label>WhatsApp</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="opcional" />
            <label>Sua autoavaliação: {form.nota}</label>
            <input type="range" min="1" max="10" step="0.5" value={form.nota} onChange={(e) => setForm({ ...form, nota: Number(e.target.value) })} />
            <PositionPicker selected={form.posicoes} onToggle={togglePos} />
            <div className="actions">
              <button className="ghost" disabled={!form.nome} onClick={() => confirm("nao")}>Não vou</button>
              <button className="primary" disabled={!valid} onClick={() => confirm("vai")}>Confirmar presença</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function PositionPicker({ selected, onToggle }) {
  return (
    <div>
      <label>Escolha 3 posições por preferência</label>
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

function TeamResult({ teams, modalidade }) {
  if (!teams?.length) return <p className="muted">Os times sorteados aparecem aqui.</p>;
  return (
    <div className="teams">
      {teams.map((team, index) => (
        <div className="team" key={team.id}>
          <div className="team-head">
            <strong>Time {index + 1}</strong>
            <span>força {team.score.toFixed(1)}</span>
          </div>
          {team.players.map((p) => (
            <div className="team-player" key={p.id}>
              <span>{p.nome}</span>
              <small>{p.assignedPosition || p.posicoes[0]} · {p.nota}</small>
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
    ? match.players.map((p) => p.id === existing.id ? { ...p, ...athlete, id: existing.id } : p)
    : [...match.players, athlete];
  return { ...match, players, teams: [] };
}

function balanceTeams(match) {
  const confirmed = match.players
    .filter((p) => p.status === "vai")
    .map((p) => ({ ...p, nota: Number(p.nota || 5) }))
    .sort((a, b) => b.nota - a.nota);
  const teamSize = MODALIDADES[match.modalidade].teamSize;
  const teamCount = Math.max(2, Math.ceil(confirmed.length / teamSize));
  const teams = Array.from({ length: teamCount }, (_, i) => ({ id: `team-${i}`, score: 0, players: [], positions: {} }));

  for (const athlete of confirmed) {
    const ranked = teams
      .filter((team) => team.players.length < teamSize)
      .map((team) => {
        const preferred = athlete.posicoes || [];
        const positionPenalty = preferred.reduce((sum, pos, index) => sum + ((team.positions[pos] || 0) * (3 - index)), 0);
        return { team, weight: team.score + positionPenalty * 0.65 + team.players.length * 0.25 };
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

function normalize(value) {
  return (value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDate(value) {
  if (!value) return "sem data";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default App;
