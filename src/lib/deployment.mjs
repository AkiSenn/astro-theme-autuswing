import { environmentsConfig as settings } from './config-loader.mjs';
import { buildMode } from './build-mode.mjs';

/** @typedef {'development' | 'preview' | 'production'} Mode */
/** @typedef {{ mode: Mode, origin: string, basePath: string }} Deployment */

const modes = ['development', 'preview', 'production'];
function invalid(field, message) {
  throw new TypeError(`src/config/environments.yml: ${field} ${message}`);
}
function readOrigin(value, mode) {
  const field = mode + '.origin';
  if (typeof value !== 'string' || !value) invalid(field, 'is required');
  if (!/^https?:\/\/[^/\\?#@\s]+\/?$/i.test(value))
    invalid(field, 'must be an origin without credentials, path, query, or fragment');
  const url = URL.parse(value);
  if (!url) invalid(field, 'must be a valid origin');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const dns = url.hostname.length <= 253 && url.hostname.includes('.') &&
    url.hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) &&
    !/^[\d.]+$/.test(url.hostname) && !url.hostname.endsWith('.localhost');
  if (mode === 'development' ? !loopback : url.protocol !== 'https:' || !dns)
    invalid(field, mode === 'development' ? 'must use a loopback host' : 'must use HTTPS and a valid DNS hostname');
  return url.origin;
}

/** @returns {Deployment} */
export function resolveDeployment(config, selected, command = 'build') {
  const mode = buildMode(selected, command === 'dev');
  if (command === 'dev' && mode === 'production')
    throw new Error('SITE_ENV: production is not allowed with the dev server');
  if (command === 'build' && mode === 'development')
    throw new Error('SITE_ENV: development cannot produce static artifacts');
  if (!config || typeof config !== 'object' || Array.isArray(config))
    invalid('configuration', 'must be an object');
  for (const key of Object.keys(config))
    if (!modes.includes(key)) invalid(key, 'is an unknown environment');
  const options = config[mode] === undefined && mode === 'development' ? {} : config[mode];
  if (!options || typeof options !== 'object' || Array.isArray(options))
    invalid(mode, 'must configure ' + mode + '.origin and may set basePath');
  for (const key of Object.keys(options))
    if (!['origin', 'basePath'].includes(key)) invalid(mode + '.' + key, 'is not supported');
  const origin = readOrigin(options.origin ?? (mode === 'development' ? 'http://127.0.0.1:4322' : undefined), mode);
  if (mode === 'production' && URL.parse(config.preview?.origin ?? '')?.origin === origin)
    invalid('production.origin', 'must differ from preview.origin');
  if (mode === 'preview' && URL.parse(config.production?.origin ?? '')?.origin === origin)
    invalid('preview.origin', 'must differ from production.origin');
  const base = options.basePath === undefined ? '/' : options.basePath;
  if (typeof base !== 'string' || !/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?)?$/.test(base))
    invalid(mode + '.basePath', 'must be / or a path of safe ASCII segments such as /blog/');
  return Object.freeze({ mode, origin, basePath: base.endsWith('/') ? base : base + '/' });
}

export function deploymentFor(command) {
  return resolveDeployment(settings, process.env.SITE_ENV, command);
}

/** @type {Deployment | undefined} */
let standalone;
export function getDeployment() {
  // Astro injects the one resolved value for all build consumers.
  return typeof __AUTUSWING_DEPLOYMENT__ !== 'undefined'
    ? /** @type {Deployment} */ (__AUTUSWING_DEPLOYMENT__)
    : standalone ??= deploymentFor('build');
}

/** Mount a known logical pathname. A route may legitimately begin with the mount name. */
export function mountPath(pathname, deployment = getDeployment()) {
  return deployment.basePath === '/' ? pathname : deployment.basePath.slice(0, -1) + pathname;
}

/**
 * Mount a logical reference; callers with final URLs can explicitly bypass mounting.
 * @param {string} value
 * @param {Deployment} deployment
 * @param {'logical' | 'mounted'} space
 */
export function mountReference(value, deployment = getDeployment(), space = 'logical') {
  if (space === 'mounted' || deployment.basePath === '/') return value;
  if (value.startsWith('/') && !value.startsWith('//')) return mountPath(value, deployment);
  if (!/^https?:\/\//i.test(value)) return value;
  const url = URL.parse(value);
  if (!url || url.origin !== deployment.origin || url.username || url.password) return value;
  // Keep the spelling of the original authority, path, query and fragment.
  const authority = value.match(/^https?:\/\/[^/?#]+/i)?.[0];
  if (!authority) return value;
  const reference = value.slice(authority.length);
  return authority + mountPath(reference.startsWith('/') ? reference : '/' + reference, deployment);
}

/** Convert a public pathname back to its logical path. */
export function unmountPath(pathname, deployment = getDeployment()) {
  if (deployment.basePath === '/') return pathname;
  if (pathname === deployment.basePath.slice(0, -1)) return '/';
  if (!pathname.startsWith(deployment.basePath)) return undefined;
  return '/' + pathname.slice(deployment.basePath.length);
}

/** Accepts a logical site route, not a previously prefixed public pathname. */
export function deploymentUrl(route, deployment = getDeployment()) {
  if (route.startsWith('/') && !route.startsWith('//'))
    return new URL(mountPath(route, deployment), deployment.origin).href;
  return new URL(route, deployment.origin + deployment.basePath).href;
}
