import type { PathOrFileDescriptor } from 'node:fs';
import type { AppearanceOptions } from './appearance-options';
import type { LayoutOptions } from './layout-options';
import type { MenuValue } from './site-options';

export interface SiteConfig {
  title: string;
  subtitle?: string;
  description: string;
  author: string;
  language: string;
  timezone: string;
  per_page: number;
  profile?: {
    avatar?: string;
    tagline?: string;
    bio?: string;
    homepage?: string;
  };
  favicon?: string | string[];
  apple_touch_icon?: string;
  menu: Record<string, MenuValue>;
  social?: Array<{
    name: string;
    url?: string;
    icon?: string;
    label?: string;
    enabled?: boolean;
  }>;
  friends?: Array<{
    name: string;
    url: string;
    description?: string;
  }>;
  footer?: {
    copyright?: {
      holder?: string;
      since?: number;
    };
    registrations?: Array<{
      label: string;
      url?: string;
      icon?: string;
    }>;
    statement?: string;
    extra?: string;
    custom_html?: string;
  };
  runtime?: {
    since: string;
    text?: string;
  };
  seo?: {
    social_image?: string;
    twitter?: string;
  };
  pwa?: {
    short_name?: string;
    icon?: string;
  };
}

export interface ThemeConfig {
  color_mode: 'auto' | 'light' | 'dark' | string;
  cards: {
    enable: boolean;
    article: boolean;
    hover: boolean;
    blur: number;
    wallpaper: string;
    wallpaper_overlay: number;
  };
  appearance: Required<AppearanceOptions> & {
    base_font_size: number;
    sidebar_width: number;
    width: number;
    background_image: boolean | number | string | string[];
    background_overlay: number;
    theme_switch: boolean;
  };
  layout?: LayoutOptions;
  motion: {
    enable: boolean;
    page: boolean;
  };
  search: {
    enable: boolean;
    content: boolean;
    max_content_length: number;
    limit: number;
    preload: boolean;
    shortcut: boolean;
    excerpt_length: number;
  };
  feed: {
    enable: boolean;
    limit: number;
    full_content: boolean;
  };
  urls: {
    length: number;
  };
  seo: {
    sitemap: boolean;
    robots: boolean;
    json_ld: boolean;
    google_verification: string;
    bing_verification: string;
    baidu_verification: string;
    sogou_verification: string;
    so360_verification: string;
    shenma_verification: string;
    yandex_verification: string;
  };
  reading: {
    toc: boolean;
    words_per_minute: number;
    related: boolean;
  };
  article: {
    excerpt: string | boolean;
    excerpt_length: number;
    excerpt_paragraphs: number;
    autospace: boolean;
    more_link: string;
    lightbox: boolean;
    lazyload: boolean;
    updated: boolean;
    word_count: boolean;
    reading_time: boolean;
    post_nav: boolean;
    share: string[];
    toc: {
      min_depth: number;
      max_depth: number;
      list_number: boolean;
      nowrap: boolean;
    };
  };
  copyright: {
    enable: boolean;
    license: string;
    url: string;
  };
  comments: {
    enable: boolean;
    provider: string;
    lazyload: boolean;
    preload: boolean;
    collapsible: boolean;
    hint: string;
    timeout: number;
    pages: boolean;
    giscus: {
      repo: string;
      repo_id: string;
      category: string;
      category_id: string;
      mapping: string;
      strict: boolean;
      reactions_enabled: number;
      input_position: string;
      theme: string;
      lang: string;
      src: string;
    };
    utterances: {
      repo: string;
      issue_term: string;
      label: string;
      theme: string;
      src: string;
    };
    disqus: {
      shortname: string;
    };
    waline: {
      serverURL: string;
      lang: string;
      cdn: string;
      css: string;
    };
    twikoo: {
      envId: string;
      region: string;
      cdn: string;
    };
    valine: {
      appid: string;
      appkey: string;
      serverURLs: string;
      cdn: string;
    };
  };
  footer: {
    copyright: boolean;
    powered_by: boolean;
    theme_name: string;
    theme_url: string;
    runtime: {
      enable: boolean;
    };
    visit_counter: {
      enable: boolean;
      provider: string;
      today_pv: boolean;
      site_pv: boolean;
      today_uv: boolean;
      site_uv: boolean;
      page_pv: boolean;
      page_uv: boolean;
      src: string;
      allow_local: boolean;
    };
  };
  math: {
    enable: boolean;
    katex: {
      config: Record<string, unknown>;
    };
  };
  analytics: {
    google_analytics: string;
    baidu_tongji: string;
  };
  assets: {
    cdn: string;
    image_fingerprint: boolean;
    preconnect: string[];
  };
  open_in_new: boolean;
  open_in_new_exclude: string[];
  performance: {
    generate_headers: boolean;
    minify: boolean;
    precompress: boolean;
    compression_min_bytes: number;
    precompress_quality: number;
    instant_nav: boolean;
  };
  pwa: {
    enable: boolean;
  };
}

export interface EnvironmentProfile {
  origin?: string;
  basePath?: string;
}

export interface EnvironmentsConfig {
  development?: EnvironmentProfile;
  preview?: EnvironmentProfile;
  production?: EnvironmentProfile;
}

export interface RedirectRule {
  from: string;
  to: string;
  status?: number;
}

export function loadYamlFile(filePath: PathOrFileDescriptor | URL): unknown;
export function loadOptionalYamlFile<T>(filePath: PathOrFileDescriptor | URL, fallback: T): T;
export const siteConfig: SiteConfig;
export const themeConfig: ThemeConfig;
export const environmentsConfig: EnvironmentsConfig;
export const redirectsConfig: RedirectRule[];
