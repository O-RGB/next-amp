# NextSona Public Site

Static public pages for NextSona. This folder is intentionally separate from
the Extension and Web Player so a public deployment cannot accidentally include
the AI model, Extension package, source maps, certificates or private keys.

## Pages

- `/` — production-style product showcase
- `/remote/` — data-only Remote Controller
- `/privacy/` — English-first Privacy Policy with Thai translation
- `/terms/` — Terms of Use with Thai translation
- `/welcome/` — First-run welcome page opened after Extension installation
- `/getting-started/` — First-run guide for installing and using the Chrome extension

## Direct deployment

This folder is already a static production site. It does not require a build
step or runtime server. Deploy the contents of `nextsona-public-site/`
directly to `https://sona.nextfeeder.com`.

The production origin is already written into the canonical tags, Open Graph
metadata, `robots.txt` and `sitemap.xml`. Third-party service and library
details are recorded in `THIRD-PARTY-NOTICES.txt`.

## Local preview

From the repository root:

```sh
python3 -m http.server 5500 --directory nextsona-public-site
```

The Remote page accepts a session in the URL fragment as
`#host=PEER_ID&token=SESSION_TOKEN`, keeps it only in memory, and clears it from
the visible address bar. A refresh therefore needs a newly generated Remote
link.

## Optional generated copy

When needed, a clean generated copy can still be created under `dist/`:

```sh
PUBLIC_SITE_ORIGIN=https://sona.nextfeeder.com npm run build:public-site
```

The generated copy includes `build-inventory.json`; it is not required when
deploying this folder directly.
