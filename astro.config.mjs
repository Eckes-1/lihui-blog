// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import icon from 'astro-icon';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkDirective from 'remark-directive';
import rehypeComponents from "rehype-components";
import cloudflare from '@astrojs/cloudflare';

import { admonition } from "./src/plugins/rehype-component-admonition.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { MusicCardComponent } from "./src/plugins/rehype-component-music-card.mjs";
import { GithubCardComponent } from './src/plugins/rehype-component-github-card.mjs';
import { QuoteComponent } from "./src/plugins/rehype-component-quote.mjs"
import { customFigurePlugin } from "./src/plugins/rehype-figure-plugin.mjs";
import { remarkCombined } from './src/plugins/remark-combined.mjs';
import { remarkTypst } from './src/plugins/remark-typst.mjs';
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs';
import { remarkLqip } from './src/plugins/remark-lqip.js';

import svelte from "@astrojs/svelte";

import { siteConfig } from './src/config';

export default defineConfig({
  site: process.env.SITE_URL || 'https://eckes.de5.net',
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  i18n: {
    locales: ['zh-cn', 'en'],
    defaultLocale: 'zh-cn',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false
    }
  },
  integrations: [icon({
    include: {
      "fa6-brands": ["creative-commons"],
      "fa6-solid": ["arrow-up", "arrow-down", "arrow-left", "arrow-right", "calendar-days", "pen-nib", "clock", "hashtag", "triangle-exclamation", "list-ul", "ellipsis", "xmark", "magnifying-glass", "globe", "circle", "align-justify", "house", "book-bookmark", "user", "link", "gear", "up-right-from-square"],
      "simple-icons": ["rss", "astro", "svelte", "tailwindcss", "github"],
      "material-symbols": ["dark-mode-outline-rounded", "wb-sunny-outline-rounded", "radio-button-partial-outline", "comment-outline-rounded"],
      "fluent": ["pin-24-filled"],
    }
  }), svelte()],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro',
      wrap: false
    },
    remarkPlugins: [
      remarkMath,
      remarkReadingTime,
      remarkDirective,
      remarkTypst,
      parseDirectiveNode,
      remarkCombined,
      [remarkLqip, { enable: siteConfig.theme.LQIP }],
    ],
    rehypePlugins: [
      rehypeKatex,
      customFigurePlugin,
      [
        rehypeComponents,
        {
          components: {
            github: GithubCardComponent,
            music: MusicCardComponent,
            quote: QuoteComponent,
            note: admonition("note"),
            tip: admonition("tip"),
            important: admonition("important"),
            caution: admonition("caution"),
            warning: admonition("warning"),
          },
        },
      ],
    ]
  },
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: [
        '@myriaddreamin/typst-ts-node-compiler',
        '@myriaddreamin/typst-ts-node-compiler-linux-x64-musl',
        'better-sqlite3',
        'sharp',
        'node:fs',
        'node:path',
        'node:fs/promises',
        'cloudflare:sockets',
        'cloudflare:email',
        /\/smtp-client\.js$/,
      ],
      noExternal: ['hono'],
    },
    resolve: {
      alias: {
        'sharp': new URL('./src/lib/sharp-shim.js', import.meta.url).pathname,
        '@myriaddreamin/typst-ts-node-compiler': new URL('./src/lib/typst-shim.mjs', import.meta.url).pathname,
      },
    },
  }
});
