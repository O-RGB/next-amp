# NextStudio Public Site

Static public pages for NextStudio. This folder is intentionally separate from
the Extension and Web Player so a public deployment cannot accidentally include
the AI model, Extension package, source maps, certificates or private keys.

## Pages

- `/` — production-style product showcase
- `/remote/` — data-only Remote Controller
- `/privacy/` — English-first Privacy Policy with Thai translation

## Local preview

From the repository root:

```sh
npm run build:public-site
python3 -m http.server 5500 --directory dist/nextstudio-public-site
```

The default build origin is `http://localhost:5500`. The Remote page accepts a
session in the URL fragment as `#host=PEER_ID&token=SESSION_TOKEN`, keeps it only
in memory, and clears it from the visible address bar. A refresh therefore needs
a newly generated Remote link.

## Production build

Set the public HTTPS origin before building:

```sh
PUBLIC_SITE_ORIGIN=https://your-domain.example npm run build:public-site
```

Deploy only `dist/nextstudio-public-site/` to the chosen static host. Do not
deploy the repository root. The build writes `build-inventory.json` and fails if
known secret, model, archive, certificate or source-map filenames enter the
output.

The Chrome Web Store URL, production domain and Extension integration are
deliberately not hardcoded yet. Update them only after the local pages and
Remote protocol have been reviewed.
