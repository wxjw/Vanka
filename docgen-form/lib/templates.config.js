import fs from 'node:fs';
import path from 'node:path';

let _cache = null;

function loadConfig() {
  if (_cache) return _cache;
  const p = path.resolve(process.cwd(), 'templates.config.json');
  const raw = fs.readFileSync(p, 'utf-8');
  _cache = JSON.parse(raw);
  return _cache;
}

export function getTemplateByKey(key) {
  const cfg = loadConfig();
  return (cfg.templates || []).find(t => t.key === key);
}
