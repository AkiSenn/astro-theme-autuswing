export interface AppearanceOptions {
  accent?: string;
  accent_dark?: string;
  font_family?: string;
  code_font?: string;
  radius?: number;
}

// 全局关键字（含草案中的 revert-rule）和 default 不能作为未加引号的字体名。
const reserved = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'revert-rule',
  'default',
]);
const generic = new Set([
  'serif',
  'sans-serif',
  'cursive',
  'fantasy',
  'monospace',
  'system-ui',
  'math',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  // Edge/WebKit 也会把这个旧别名当作独占成员的关键字。
  '-webkit-body',
]);
const identifier = /^(?:--|-?[_a-zA-Z\u0080-\u{10ffff}])[-_a-zA-Z0-9\u0080-\u{10ffff}]*$/u;
const unsafeFontCharacters = /[\\;:{}<>\p{Cc}\p{Cs}]/u;
const asciiLower = (word: string) => word.replace(/[A-Z]/g, (letter) => letter.toLowerCase());

function validFontFamily(source: string) {
  const member = source.replace(/^ +| +$/g, '');
  const first = member[0];
  if (first === '"' || first === "'") {
    return member.length > 2 && member.endsWith(first) && !member.slice(1, -1).includes(first);
  }
  const words = member.split(/ +/);
  // 关键字只在成员开头独占一项；Noto Serif 一类名称仍可裸写。
  if (words.length > 1 && generic.has(asciiLower(words[0]))) return false;
  return words.every((word) => identifier.test(word) && !reserved.has(asciiLower(word)));
}

function validFontStack(value: string) {
  if (value.length > 500 || unsafeFontCharacters.test(value)) return false;
  let quote = '';
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ',') {
      if (!validFontFamily(value.slice(start, index))) return false;
      start = index + 1;
    }
  }
  return !quote && validFontFamily(value.slice(start));
}

export function normalizeAppearance<T extends AppearanceOptions>(input: T) {
  const color = (key: 'accent' | 'accent_dark') => {
    const value = input[key] === undefined ? '' : input[key];
    if (typeof value !== 'string' || (value !== '' && !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)))
      throw new TypeError(`appearance.${key}: 使用空字符串或 #RGB / #RRGGBB 颜色`);
    return value;
  };
  const font = (key: 'font_family' | 'code_font') => {
    const value = input[key] === undefined ? '' : input[key];
    if (typeof value !== 'string' || (value !== '' && !validFontStack(value)))
      throw new TypeError(
        `appearance.${key}: 使用逗号分隔的字体族；通用字体关键字须单独成项，保留字作为字体名须加引号，禁止控制字符、CSS 声明和转义`,
      );
    return value;
  };
  const radius = input.radius === undefined ? 18 : input.radius;
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0 || radius > 32)
    throw new TypeError('appearance.radius: 使用 0–32 的有限数字，单位 px');
  return {
    ...input,
    accent: color('accent'),
    accent_dark: color('accent_dark'),
    font_family: font('font_family'),
    code_font: font('code_font'),
    radius,
  };
}
