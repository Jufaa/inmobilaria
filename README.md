# Nombre de Empresa — Río Cuarto

## Seller demo: start here

Open `/vendedor` to manage three independent example agencies. Each card opens its public map or management panel; new agencies start with an empty Río Cuarto catalog. Active/paused is a local presentation status: paused agencies still allow labeled previews. There is no authentication or server access enforcement.

| View | Route |
| --- | --- |
| Seller portfolio | `/vendedor` |
| Agency map | `/inmobiliaria/<agencyId>` |
| Agency management | `/inmobiliaria/<agencyId>/panel` |
| Guided local trial | `/inmobiliaria/<agencyId>/prueba` |

The original `/`, `/panel`, and `/prueba` remain aliases for `principal`. Its existing repository/favorites keys are preserved without moving or resetting data. Other agencies use separate repository, favorites, and trial keys; inquiries, visits, brand settings, and published records belong to that agency's repository. Shared property links include the agency ID. The seller registry is separate from agency branding; cards read the latest saved agency name/logo/color and catalog counts when the seller view mounts or the window regains focus. These are local record counts, not analytics.

To demonstrate the workflow: open an agency panel, edit or publish a property, return to the seller, then open another agency and confirm that its catalog and inquiries are unchanged. Creating, pausing, or editing a company affects only this browser. Sharing a custom agency URL does not transfer its local data to another browser.


A frontend-only real estate prototype for Río Cuarto, Córdoba, Argentina, built with Next.js App Router, TypeScript, Mapbox GL JS, and Three.js (the demo panorama). No backend, authentication, deployment, or outgoing inquiry service is configured.

## Run and check

```sh
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

Open http://localhost:3000. Tests use Node 22.18+ native TypeScript stripping.

## Activate Mapbox

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to your own public Mapbox token (`pk.`) from your [Mapbox account](https://account.mapbox.com/access-tokens/). Never use a secret (`sk.`) token in frontend configuration. Restrict the public token to your development and production domains in Mapbox. Restart the development server after changing it; rebuild production because Next.js inlines `NEXT_PUBLIC_` variables at build time.

Without a token, the catalog remains available and the map shows its activation state. Unauthorized requests, connection failures, and unsupported WebGL have useful fallbacks. Requests require internet access and are subject to your Mapbox account usage and billing. Provider logo and attribution remain visible.

## Simple apartment search

The initial search type is **Departamento**; the visible “Tipo de inmueble” control switches to all properties, houses, or PH. “Limpiar búsqueda” restores the apartment default. Mapa and Listado are equally prominent views, and switching views preserves the map instance.

Location text is a draft until Enter, “Buscar”, or a suggestion is selected. Exact location aliases include “sur”, “zona norte”, “departamentos zona sur”, barrio names, and comma/“y”-separated known areas. The exact typo “usr” suggests Sur and displays an explicit correction notice when applied; arbitrary fuzzy matching is not used. Arrow keys navigate suggestions, Enter selects, and Escape dismisses them. Selecting multiple areas uses OR; property type, budget, bedrooms, favorites, and amenities combine with AND.

Budget maximum and bedrooms are visible. Minimum budget and optional amenities are in “Más filtros”. Active chips remove one constraint at a time. Empty states show optional relaxations only when matching demo alternatives actually exist. Invalid budget ranges show an explanation. “Buscar en esta zona” explicitly captures the geographic viewport envelope; panning alone never filters the catalog.

The interface uses one teal action color, larger labeled inputs, 48px primary controls, a result summary, and a Listado alternative. These decisions are informed by [W3C's older-user guidance](https://www.w3.org/WAI/older-users/developing/) and [enhanced target-size guidance](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html), alongside [NN/g's filter guidance](https://www.nngroup.com/articles/filter-categories-values/). They are not a full WCAG conformance audit or a guarantee of usability for every older adult. Browser, assistive-technology, zoom/reflow, and actual-user testing remain necessary.

## Geography and static-data boundaries

The initial camera is near the city center (`longitude -64.3488`, `latitude -33.1231`, zoom 15.8, pitch 55°). The municipality's [environmental assessment](https://riocuarto.gov.ar/files/documentos/1573039512_EIAyS%20RIO%20CUARTO.pdf) identifies the city near 33°07′23″ S / 64°20′53″ W. [Municipal reporting](https://www.riocuarto.gob.ar/noticias/presentaron-un-nuevo-esquema-territorial-2026-04-11) confirms Banda Norte, Alberdi, and the central sector; the [official tourism portal](https://www.destinoriocuarto.gob.ar/servicio/lago-villa-dalcar) places Villa Dalcar west of the city.

Norte, Sur, Este, Oeste, and Centro are **schematic search sectors**, not official administrative geography. Their rectangles express orientation around the center; neighborhood labels are kept separately. Listing coordinates, locations, prices, amenities, photos, and tours are explicitly fictional examples, not real inventory or verified address geocodes. The southern sector includes two apartment samples. No commute times, safety scores, or market statistics are inferred.

`lib/properties.ts` holds the typed catalog, `lib/zones.ts` the illustrative areas and exact query aliases, and `lib/search.ts` pure filtering. Replace these boundaries with your API, verified property coordinates, and official area data when implementing a backend.

`components/CityMap.tsx` maintains one real [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/) map with soft natural context colors and visible 3D buildings where provider coverage permits. Explicit area searches fit their bounds; selecting a marker focuses that property. A ResizeObserver handles view changes. Camera pitch alone does not guarantee detailed 3D coverage in Río Cuarto.

`components/Panorama.tsx` renders a real equirectangular sample from the Three.js examples, explicitly identified as unrelated to the selected listing. Unsplash photos, the threejs.org panorama, and Google Fonts require network access. Inquiry controls explain the future WhatsApp integration without sending data.

## Verification

Focused tests cover accents, combined filters, operation/favorites, inclusive viewport bounds, antimeridian handling, recovery, demo-area containment, explicit region aliases, multiple-area OR semantics, and apartment/all-property discovery. Build and TypeScript checks verify compilation; they do not replace visual or usability QA.

## Agency workspace and end-to-end local demo

Open `/panel` using “Panel inmobiliaria” in the buyer header. The workspace includes overview counts derived from the same local catalog/consultations, property search and lifecycle states, a three-step editor, consultation follow-up, appointment scheduling, and brand name/logo/color settings. The catalog distribution chart is a snapshot of demo records, not traffic or sales analytics.

Publish a property in the workspace and it appears in the public map/list for the same browser. Draft and sold records stay private to the demo panel; reserved records remain visible. The public detail view supports illustrative galleries, a clearly labeled generic schematic floor plan, amenities, monthly expenses with their own explicit currency, and rental subtotals only when informed components share the same currency. Shared links use `/#propiedad=<id>` and resolve existing local/public records; custom local records do not automatically transfer to another browser.

“Enviar consulta de prueba” creates a local consultation visible in the panel. Follow-up status, internal notes, and future appointments persist locally. Copying a WhatsApp reply only copies text; nothing is sent externally. Brand settings update the public header and action accent, with validation for white-text contrast. HTTPS image/panorama URLs are validated; panoramas load as image textures, never arbitrary HTML/iframes.

`components/DemoProvider.tsx` hydrates the shared repository before persisting changes. `lib/demo-repository.ts` validates stored data, relationships, property fields, URL schemes, and brand color. Storage is scoped to `territorio-demo-v1`; reset also removes the existing `territorio-favorites` key, never all localStorage. Reset is an explicit two-step action in the panel. Storage failures leave the current session usable and display a local-storage notice.

This is a single-browser mockup: no authentication, authorization, multi-tenant isolation, server database, real leads, uploads, billing, email, WhatsApp delivery, or shared account persistence. External photos and map assets still require network access. Use the domain/provider boundary when adding your backend.

## Expanded rental examples and additive startup migration

The seed catalog contains 18 fictional rentals: Centro 5, Norte 4, Sur 4, Este 3, Oeste 2. Fourteen new examples add studios and one/two/three-bedroom apartments, plus one house and one PH, with distinct illustrative coordinates, galleries, amenities, monthly expenses, and optional sample panoramas. New seed rents are fictional ARS amounts, not market evidence or exchange-rate conversions. Saved older USD records retain their amounts and currency. Locations describe a neighborhood/sector instead of fabricating exact addresses.

The municipality's [Plaza Bimaco project](https://pp.riocuarto.gob.ar/proyectos/espacio-familiar-inclusivo-y-saludable-en-plaza-bimaco_id_232) explicitly identifies Bimaco in the Sur sector. The Bimaco search rectangle is still an illustrative approximation, not an official boundary or geocoding result.

`mergeDemoSeeds` adds unseen seed IDs to a valid saved repository before it is persisted. Existing edits, custom properties, brand, inquiries, visits, and the separate favorites key are preserved. Optional `seedIds` metadata is backward compatible with older version-1 repositories and prevents duplicate additions; tracked removed examples are not recreated at the next startup. Reset is not necessary to see the new rentals.

## Present the fictional property and run a real trial

1. Open `/#propiedad=201`: a fictional one-bedroom apartment with two coherent generated living/kitchen images and a synthetic 2:1 spherical panorama. The media is generated for this mockup, not a captured or measured real residence. The 360 view shows one environment; it is not a multi-room scanned tour or a guarantee of seamless geometry. Assets are served from the controlled `/demo-assets/` directory.
2. Check the explicit ARS/USD price, monthly expenses, deposit, requirements, and informed-component subtotal. Unknown expenses remain unknown. Original currencies remain stored unchanged; sale prices are never added to monthly expenses. The ARS/USD selector filters by original currency; budget filters and price sorting compare matching native amounts. Argentine budget grouping such as `800.000` means 800000.
3. Open `/prueba` (linked in the panel) with prospective users. Its six task results begin pending; participants mark completion/difficulty and enter local notes themselves. The guide does not simulate or claim a completed human usability test, collect telemetry, or send notes externally.

The legacy repository migration sets absent currency metadata to USD without changing stored prices/expenses; newly added seed201 is additive. Switching search currency clears the budget explicitly rather than reinterpreting a typed amount.

## Expanded apartment catalog and map interaction

Ten additional fictional apartments use stable IDs301–310 (eight rentals in ARS and two sales in USD), with distinct illustrative coordinates throughout Río Cuarto. The additive repository migration preserves earlier edits and imports new IDs once. Rental seeds now total26: Centro7, Norte6, Sur6, Este4, Oeste3.

Mapbox's native GeoJSON clustering groups nearby properties at lower zoom. Accessible group buttons show the number of records, never an invented average price; clicking expands the actual cluster. Price buttons are maintained only for visible unclustered points, with RAF-bounded viewport updates and no source refresh on selection-only changes. The map instance remains mounted across filters and tabs. Initial pitch is45°; transitions are shorter, clicking an already-selected property does not fly again, and “Ver propiedades” reserves space for the search panel. The search panel can be hidden/reopened without clearing its state.

These address concrete source-level clutter and camera causes. They are not measured FPS improvements or completed visual/usability testing; the real Mapbox rendering still requires browser QA.

## Native price currencies

The public ARS/USD selector filters properties by their original price currency. Prices, expenses, and deposits are never converted. Budgets and sorting compare only matching native currencies; mixed-currency costs remain separate. All quote API/network/cache behavior has been removed. The default brand remains Nombre de Empresa and map reset restores the complete camera with zero bearing.
# inmobilaria
