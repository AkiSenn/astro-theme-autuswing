import fs from 'node:fs';
import { load, JSON_SCHEMA } from 'js-yaml';

const configDir = new URL('../config/', import.meta.url);

export function loadYamlFile(filePath) {
  return load(fs.readFileSync(filePath, 'utf8'), { schema: JSON_SCHEMA });
}

export function loadOptionalYamlFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const parsed = loadYamlFile(filePath);
  return parsed === undefined || parsed === null ? fallback : parsed;
}

export const siteConfig = loadYamlFile(new URL('site.yml', configDir));
export const themeConfig = loadYamlFile(new URL('theme.yml', configDir));
export const environmentsConfig = loadYamlFile(new URL('environments.yml', configDir));
export const redirectsConfig = loadOptionalYamlFile(new URL('redirects.yml', configDir), []);
