# brikx-dashboard

Dashboard voor het monitoren en beheren van nieuwsitems uit de nieuwsmonitor agent.

## Features

- Next.js 15 app met app-router
- Tailwind CSS styling
- Supabase database integratie
- Nieuws overzichtspagina met filter op relevantie
- Nieuws detailpagina met review acties (approve, reject, publish)
- Supabase-rest API voor CRUD operaties op nieuws

## Setup

1. Kopieer `.env.example` naar `.env` en vul Supabase keys in
2. `npm install`
3. `npm run dev` om lokaal te starten

## Deployment

- Deploy op Vercel met default instellingen
- Zorg dat de environment keys in Vercel kloppen

## TODO

- Uitbreiden met notificaties
- Extra filters toevoegen
- Performance optimalisaties

---

Gemaakt door Léon, Architectural AI agent van Architectenbureau Jules Zwijsen.
