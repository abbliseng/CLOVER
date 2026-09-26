/**
 * Tiny arithmetic parser for the cost field: digits, + - * / and parentheses.
 * Typed text is never executed as code.
 */

type Token = { type: 'num'; value: number } | { type: 'op'; value: string };

const OPS = new Set(['+', '-', '*', '/', '(', ')']);

function normalise(input: string): string {
  return input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
}

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch >= '0' && ch <= '9') {
      let j = i;
      let dots = 0;
      while (j < input.length && ((input[j] >= '0' && input[j] <= '9') || input[j] === '.')) {
        if (input[j] === '.' && ++dots > 1) return null;
        j++;
      }
      tokens.push({ type: 'num', value: Number(input.slice(i, j)) });
      i = j;
    } else if (ch === '.') {
      let j = i;
      while (j < input.length && (input[j] === '.' || (input[j] >= '0' && input[j] <= '9'))) j++;
      const value = Number(input.slice(i, j));
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'num', value });
      i = j;
    } else if (OPS.has(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
    } else {
      return null;
    }
  }
  return tokens;
}

/** Returns the value in kronor, or null when the expression is incomplete or invalid. */
export function evaluateExpression(input: string): number | null {
  const text = normalise(input);
  if (text === '') return null;
  const tokens = tokenize(text);
  if (!tokens) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const eatOp = (...values: string[]) => {
    const t = peek();
    if (t && t.type === 'op' && values.includes(t.value)) {
      pos++;
      return t.value;
    }
    return null;
  };

  function parsePrimary(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.type === 'num') {
      pos++;
      return t.value;
    }
    if (t.value === '-' || t.value === '+') {
      pos++;
      const v = parsePrimary();
      return v === null ? null : t.value === '-' ? -v : v;
    }
    if (t.value === '(') {
      pos++;
      const v = parseSum();
      if (v === null || !eatOp(')')) return null;
      return v;
    }
    return null;
  }

  function parseProduct(): number | null {
    let left = parsePrimary();
    if (left === null) return null;
    for (;;) {
      const op = eatOp('*', '/');
      if (!op) return left;
      const right = parsePrimary();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
  }

  function parseSum(): number | null {
    let left = parseProduct();
    if (left === null) return null;
    for (;;) {
      const op = eatOp('+', '-');
      if (!op) return left;
      const right = parseProduct();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
  }

  const value = parseSum();
  if (value === null || pos !== tokens.length || !Number.isFinite(value)) return null;
  return value;
}

/** Evaluates the field text and rounds to whole öre. */
export function evaluateToOre(input: string): number | null {
  const value = evaluateExpression(input);
  if (value === null) return null;
  const ore = Math.round(value * 100);
  return Number.isSafeInteger(ore) ? ore : null;
}
