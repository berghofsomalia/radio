# Radio Archive

A bilingual public archive and private moderator workspace for the Garasho-wadaag and Hiloow radio programmes.

## Included

- Public Somali and English archive backed by Supabase
- Search, programme and year filters
- Participation statistics, including women, youth, elders and government
- Shared episode, drama and guest editing
- Protected repeat-drama references enforced by Supabase Row Level Security
- Automatic GitHub Pages deployment

The website uses the Supabase publishable key in browser code. No service-role key, database password or internal repeat-reference data is stored in this repository.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run check
```

The site is built into `dist/`. Pushing `main` triggers the GitHub Pages workflow.
