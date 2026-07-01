# CEOFut

Organizador de futebol desenvolvido pelo CEO Group.

## Fluxos do MVP

- CEO cria um futebol nas modalidades Futsal, Society ou Campo.
- CEO copia um link de convite.
- Atleta confirma presença pelo link.
- Atleta cadastra nome, WhatsApp opcional, nota e 3 posições por preferência.
- CEO ajusta nota/status e sorteia times equilibrados por força e posição.
- Botão de assinatura preparado via `VITE_CHECKOUT_URL`.

## Variáveis no Vercel

```env
VITE_APP_URL=https://seu-app.vercel.app
VITE_CHECKOUT_URL=https://seu-projeto.supabase.co/functions/v1/ceofut-pagamento/criar
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica
```

Sem Supabase configurado, o MVP funciona com `localStorage` para teste rápido.

## Tabela opcional no Supabase

```sql
create table if not exists ceofut_snapshots (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
```

Depois, o ideal é evoluir para tabelas separadas de `ceos`, `matches`, `players` e `subscriptions`.
