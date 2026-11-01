// Regras financeiras compartilhadas entre festa, financeiro, painel e relatórios.
// Cada pagamento é: valor a receber (entrada/parcela/extra), desconto concedido
// ou reembolso. "Recebido" = linha com data de pagamento.
import { today } from './ui.js';

export const RECEIVABLE = ['entrada', 'parcela', 'extra'];

export function isOverdue(p) {
  return RECEIVABLE.includes(p.kind) && !p.paid_at && p.due_date && p.due_date < today();
}

// Resumo financeiro de uma festa (ou de qualquer lista de pagamentos)
export function eventBalance(contractValue, payments) {
  const sum = (f) => payments.filter(f).reduce((s, p) => s + Number(p.amount), 0);
  const extras = sum((p) => p.kind === 'extra');
  const discounts = sum((p) => p.kind === 'desconto');
  const received = sum((p) => RECEIVABLE.includes(p.kind) && p.paid_at) - sum((p) => p.kind === 'reembolso' && p.paid_at);
  const owed = Number(contractValue || 0) + extras - discounts;
  const scheduled = sum((p) => p.kind === 'entrada' || p.kind === 'parcela');
  return {
    contract: Number(contractValue || 0), extras, discounts, owed, received,
    balance: Math.round((owed - received) * 100) / 100,
    overdue: sum(isOverdue),
    unscheduled: Math.max(0, Math.round((Number(contractValue || 0) - discounts - scheduled) * 100) / 100),
  };
}

// Entradas efetivas no caixa (recebimentos menos reembolsos) dentro de um período
export function cashIn(payments, from, to) {
  const inRange = (d) => d && (!from || d >= from) && (!to || d <= to);
  return payments.reduce((s, p) => {
    if (!inRange(p.paid_at)) return s;
    if (RECEIVABLE.includes(p.kind)) return s + Number(p.amount);
    if (p.kind === 'reembolso') return s - Number(p.amount);
    return s;
  }, 0);
}

// Períodos usados nos filtros
export const PERIODS = { mes: 'Este mês', mes_passado: 'Mês passado', '3m': 'Últimos 3 meses', ano: 'Este ano', tudo: 'Todo o período' };
export function periodRange(key) {
  const d = new Date();
  const ymd = (x) => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const first = (y, m) => ymd(new Date(y, m, 1));
  const last = (y, m) => ymd(new Date(y, m + 1, 0));
  const y = d.getFullYear(), m = d.getMonth();
  switch (key) {
    case 'mes': return { from: first(y, m), to: last(y, m) };
    case 'mes_passado': return { from: first(y, m - 1), to: last(y, m - 1) };
    case '3m': return { from: first(y, m - 2), to: last(y, m) };
    case 'ano': return { from: `${y}-01-01`, to: `${y}-12-31` };
    default: return { from: null, to: null };
  }
}
export const inPeriod = (dateStr, { from, to }) => !!dateStr && (!from || dateStr.slice(0, 10) >= from) && (!to || dateStr.slice(0, 10) <= to);
