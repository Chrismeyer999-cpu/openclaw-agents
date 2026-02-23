# AI Agent Regels — Verplicht naleven

## Bestandslimieten
- Max 200 regels per component bestand
- Max 150 regels per API route / Edge Function
- Max 100 regels per utility bestand
- Bij overschrijding: splits in kleinere bestanden, geen uitzonderingen

## Naamgeving
- Components: PascalCase (PillarPagesTable.tsx)
- Utils/lib: camelCase (supabaseClient.ts)
- API routes: kebab-case mappen

## Imports
- Gebruik altijd @/ path aliases, nooit relatieve ../../../
- Supabase server client: altijd via lib/supabase/server.ts
- Supabase client: altijd via lib/supabase/client.ts

## Verboden
- Geen any types
- Geen console.log in productie code
- Geen hardcoded strings (workspace IDs, URLs)
- Geen mock of placeholder data

## Bij elke taak
1. Lees summary.md
2. Lees de relevante spec in specs/
3. Lees relevante docs/ als de taak een externe API raakt
4. Schrijf alleen de bestanden die in de spec staan
5. Update tasks.json status naar "done" na voltooiing
