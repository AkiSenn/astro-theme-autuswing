import { generate, parse, walk } from 'css-tree';

export function mapInlineCssUrls(style, map) {
  if (!/url\(/i.test(style)) return style;
  const edits = [];
  walk(parse(style, { context: 'declarationList', positions: true, parseCustomProperty: true }), {
    visit: 'Url',
    enter(node) {
      const value = map(node.value);
      if (value !== node.value)
        edits.push([node.loc.start.offset, node.loc.end.offset, generate({ ...node, value })]);
    },
  });
  // Keep declarations, strings and comments outside the changed URL tokens as authored.
  for (const [start, end, url] of edits.reverse()) style = style.slice(0, start) + url + style.slice(end);
  return style;
}
