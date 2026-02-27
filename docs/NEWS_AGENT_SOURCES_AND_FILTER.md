# NewsAgent – bronnen + filterstrategie (NL bouw/subsidie/regelgeving)

## Status nu
- NOS RSS: **werkend**
  - `https://feeds.nos.nl/nosnieuwsalgemeen`
  - `https://feeds.nos.nl/nosnieuwseconomie`
- BNR RSS: **niet direct benaderbaar** vanaf server (HTTP 403 op bekende RSS-routes)
  - Advies: via aggregator/fallback (Google News query op `site:bnr.nl`), of browser-based fetch.

## Aanbevolen primaire bronnen (hoog vertrouwen)
1. NOS (algemeen/economie)
2. Rijksoverheid feeds
   - `https://feeds.rijksoverheid.nl/nieuws.rss`
   - onderwerp-feeds (bijv. bouw/energie/subsidie) via:
     - `https://feeds.rijksoverheid.nl/onderwerpen/<onderwerp>/nieuws.rss`
3. Bouwwereld feed
   - `https://www.bouwwereld.nl/feed/`
4. Architectenweb feed
   - `https://architectenweb.nl/rss`

## Secundaire bronnen (alleen met streng filter)
- ArchDaily (internationaal, vaak weinig NL-regelgeving)
- Algemene AI/tech blogs (alleen meenemen bij directe bouw/regelgeving-link)

## BNR aanpak (pragmatisch)
Omdat directe RSS op dit moment 403 geeft:
- Gebruik bronprofiel `bnr_fallback` met query’s op:
  - `site:bnr.nl bouw`
  - `site:bnr.nl woningmarkt`
  - `site:bnr.nl omgevingswet`
  - `site:bnr.nl subsidie`
- Bewaar URL + titel + snippet en laat de inhoud pas ophalen bij voldoende relevantiescore.

## Filterontwerp (2-fase)

### Fase 1 — Bron + trefwoorden (snel)
- Score op kernwoorden (omgevingswet, bestemmingsplan, vergunning, woningbouw, kavel, subsidie, enz.)
- Strafpunten op irrelevante topics (sport, onderwijs, generieke AI-hype, zorg zonder bouwcontext)
- Hard block op generieke AI-nieuwswoorden zonder bouwcontext

### Fase 2 — Contextcheck (LLM/classifier)
Classificeer als:
- `REGELGEVING`
- `SUBSIDIE`
- `KAVEL/MARKT`
- `TECHNIEK/UITVOERING`
- `NIET_RELEVANT`

Publiceer alleen als:
- label != `NIET_RELEVANT`
- + confidence >= 0.70
- + ten minste 1 van deze intents:
  - particulier bouwen
  - vergunning/planregels
  - subsidieregeling
  - bouwkosten/materialen met directe toepasbaarheid

## Praktische instellingen
- Doelvolume: **2–5 sterke items/dag** (geen ruis)
- Dedup: hash op genormaliseerde titel + domein + datum
- Cooldown: geen vrijwel identieke headlines binnen 72 uur
- Prioriteitsscore:
  - +2 officiële bron (Rijksoverheid/NOS)
  - +2 regelgeving/subsidie
  - +1 lokale toepasbaarheid NL particulier
  - -2 internationale inspiratie zonder toepasbare regelimpact

## Datamodel (aanvulling voorstel)
Voeg velden toe aan nieuwsitem:
- `source_tier` (`primary|secondary|fallback`)
- `relevance_score` (int)
- `topic_label`
- `confidence` (numeric)
- `decision_reason` (text)
- `is_duplicate` (bool)

Hiermee kun je later perfect auditen waarom iets wel/niet is doorgelaten.
