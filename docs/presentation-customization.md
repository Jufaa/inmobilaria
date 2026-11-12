# Agency map customization

## Who can edit

Only the **system-wide administrator** (`PlatformRole.OWNER`) may modify properties, settings, branding, offers, zones, inquiries, collaboration or rentals. An agency membership named OWNER, ADMIN or EDITOR does not grant editing authority. Existing viewing permissions are retained. Read-only mutation forms are disabled, and server actions independently reject unauthorized writes and photo-token requests.

## Fullscreen map navigation

The main agency map fills the browser viewport. **Operación** opens the left sidebar with navigation, property/zone search, filters and the property-color legend. **Administración** opens the right sidebar with administration links, appearance, workspace switching and sign-out. Both drawers can be closed to uncover the map. On narrow screens opening one closes the other; Escape closes the focused drawer and returns focus to its toggle. Other panel pages retain their existing standard layout.

Search results distinguish real properties, fictional examples and zones. Selecting a result opens that target using the existing guarded/detail flow; explicit example selection clears conflicting filters. Filters stay in the left sidebar rather than consuming vertical space above the map. This layout does not change edit permissions or stored catalogue data.

## Everyday workflow

Open `/inmobiliaria/<agency-slug>/panel`.

1. Select a zone on the overview. After its optional video, select **Agregar propiedad** in the aerial view, then click the property's actual location on the map.
2. Enter its title, type, operation, price, address, neighborhood and area. Coordinates are captured automatically, not typed.
3. Add up to six JPEG, PNG or WebP photos, maximum 5 MiB each. Additional details are under **Más datos**.
4. Save. New listings default to **Borrador** and are not published unless **Publicar en el catálogo** is explicitly chosen.
5. Select a property marker to see only that listing. **Editar propiedad** opens the same short form; existing media are retained and new photos are appended. **Volver al mapa** returns to the map.

The main map retains example zones, reference pins and the aerial/sample tour experience, The initial overview displays only zones, without property or reference pins. Only property pins appear in the aerial zone view after its optional transition. The separate reference-pin creation/management workflow is removed from this experience; previously stored reference data are not deleted. Selecting a zone focuses its bounds and opens its existing example aerial tour, with its optional transition video. Example tours remain explicitly fictional and are never inserted into the real catalogue. Selecting a real property marker in that aerial view opens its actual listing instead. Use **Zona anterior**, **Elegir zona** or **Zona siguiente** to focus another zone directly without returning to the overview or replaying the transition. Use the single **Agregar propiedad** action in this aerial view. There is no separate **Agregar chincheta** or point-of-interest workflow here. Example interiors focus only on the selected home, without the other-property sidebar. Properties missing a location remain accessible in **Propiedades**. Map-level hiding is a presentation preference, not an unpublish or access-control mechanism.

## Personalization

Open `/inmobiliaria/<agency-slug>/panel/personalizacion` as the system-wide administrator. Other authorized agency members can view but cannot edit.

| Panel | Purpose |
| --- | --- |
| **Identidad** | Choose the primary brand color, logo, cover and welcome link. The primary color previews the current agency's panel accents immediately; save to persist it across pages/devices. Arbitrary colors receive contrasting button text. Only the system administrator can save them. |
| **Mapa** | Name the map, optionally upload prepared artwork, add and edit zones. The main experience uses property pins only; existing reference data remain stored for legacy/catalogue consumers. **Agregar zona** arms a drag selection: press, drag the rectangle and release. Escape or **Cancelar** discards the unfinished selection. No new zone exists before a valid release. Select an existing zone to rename, recolor, hide, redraw or remove it. Property placement is available only after entering a zone, through **Agregar propiedad**. |
| **Inmuebles** | Set map visibility and offer highlighting for actual catalogue records. Add or edit real listings using the embedded map. Listing saves are immediate catalogue operations, separate from **Guardar cambios** for presentation preferences. |
| **Apariencia** | Choose map, window and property-type colors (Casa, Departamento, Dúplex, PH, Lote, Local, Otro); Google 3D property pins use the actual colored PinElement fill, not only CSS text color; configure visible visitor filters and whether prices appear before selection. Offers remain highlighted. |

Select a preset swatch or **Más colores**. RGB and hexadecimal values update automatically. Use **Guardar identidad** for branding and **Guardar cambios** for map/display preferences. Unsaved changes are not deployment configuration.

Zone selections use the interactive map viewport or the actual prepared image bounds. Artwork must be correctly georeferenced externally; the app does not invent official neighborhood boundaries. Presentation zones remain separate from the **Barrios** catalogue administration section. Zone video links are optional and externally supplied; legacy sample-template panels are excluded from the real workflow.

## Property summaries and offers

Focused example tours show the selected price, area, bedrooms, bathrooms and features without a competing-property sidebar. The system administrator can use **Editar precio y características** there, or **Personalización → Inmuebles → Propiedades de ejemplo**. Example changes remain explicitly fictional presentation preferences; they do not create catalogue rows. Real listings retain the real-property edit form and server-side validation.

The system administrator has **Administración → Ofertas** (`/panel/ofertas`). Select a real property or an explicitly fictional example, enter an offer title/description/price/currency and save it as active or hidden. Active offers appear in a dismissible popup at the bottom right of the overview and aerial view. Selecting one opens the matched property. An offer never changes the catalogue's original price, and unresolved or hidden offers do not render.

## Automatic playback and fictional intro

The main agency entry uses a newly generated, explicitly fictional 10-second intro at `/demo-assets/tours/agency-fictional-intro.mp4`. It is a local ffmpeg Ken Burns motion graphic made from the existing fictional living-room illustration, not newly generated AI-video footage or a real property recording. Reproduce it with `node scripts/generate-fictional-intro.mjs`; the poster is `agency-fictional-intro-poster.jpg`.

The former built-in intro URL is adapted only for the main agency experience. Custom URLs and a saved opt-out on the new asset remain intact; shared/legacy defaults remain opt-in. Change the new intro toggle in **Personalización → Mapa → Video de entrada**.

Agency entry, zone transitions and focused property entrances request muted inline autoplay; browser rejection exposes a retry/continue fallback rather than failing silently. Reduced-motion preferences skip automatic movement/video. Focused interior video is also started explicitly once the real motion preference is known. Browser autoplay policies still apply.

## Photos: required deployment setup

The app uses direct browser uploads to Vercel Blob, avoiding the existing 3 MB server-action request limit. Configure a public Vercel Blob store and its server-only `BLOB_READ_WRITE_TOKEN` in each intended environment. Do not expose that token as `NEXT_PUBLIC_*` or commit it. Provisioning storage, connecting credentials and deployment are separate operations requiring authorization.

Without the token, the photo control is disabled and records can still be saved without photos. The upload endpoint authorizes the agency membership, restricts the canonical agency namespace, content types and size, and denies overwrites. Saving verifies the uploaded pathname against the deployment's own Blob store before adding PHOTO records atomically with the property. Edits preserve existing media and enforce the total photo limit within a serializable transaction; a concurrent conflict returns an error rather than silently retrying.

**Public photos have public URLs even when the listing is a draft.** Do not upload private documents or sensitive images. Failed listing saves can leave unreferenced uploads; no automatic storage cleanup is implemented. File metadata/type checks are not malware scanning. Storage lifecycle, retention and operational abuse limits need review before production use.

No live Blob upload or authenticated browser session is established by the automated unit tests. Before deploying, test a real authorized upload/save/reload, tenant isolation, image rendering and error recovery. Also review existing demo authentication/accounts and environment flags; these visual/catalogue changes do not certify the existing deployment as production-ready.

## Other sections

- **Propiedades** manages the real catalogue and availability; its older form remains available.
- **Consultas** tracks inquiry follow-up. **Estadísticas** shows recorded activity.
- **Barrios** manages catalogue neighborhoods and property assignments.
- **Colaboración** manages agency connections and eligible shared listings.
- **Alquileres** manages contacts, contracts, charges, payments and expenses; printable drafts require independent validation.

The agency main map loads its saved example configuration; restoring examples does not delete real records or replace saved map settings. **Compartido** retains its previous behavior. No **Dueño directo** section is added. Existing optional presentation settings and legacy shared/demo consumers remain compatible.

### Offer colors

The system administrator can choose **Color de la oferta** when creating or editing an offer. Existing offers default to yellow. Saving updates the offer card color without changing the property price; the text switches between black and white for contrast. Each offer is a single colored card with its own close control, without an outer offers frame. Offers appear at the bottom right of the map, with space for map attribution and the administration drawer. On narrow screens they are hidden while a sidebar is open.

### Optional marketplace search

Search and filters live in an independent **Filtros** button at the upper left of the map, outside the Operation sidebar. The button is pinned to the upper-left viewport edge and does not move when Operation opens. Operation navigation, the color legend and other sidebar options stay in Operation. Text search matches normalized title, neighborhood, address, description, type and features. Optional criteria include zone, sale/rental, currency and price range, type, bedroom range, garage, area range, minimum bathrooms, comma-separated amenities, status and offers only. Blank fields impose no restriction. Prices remain in their original currencies and are never converted. Hidden legacy filters remain disabled.

Using a search or filter shows matching property cards on the right with a photo (or “Sin foto”), price and key characteristics. Results load in batches of twelve, can be collapsed, and open the exact selected property. Search-card selection preserves criteria; explicit promotional-offer navigation still clears conflicting search criteria. Clearing resets both text and filters. Dedicated promotional popups are temporarily hidden while search results are active so the two do not overlap.

The same controls and results are rendered inside the native aerial dialog, not behind its inert backdrop. Examples retain their illustrative label and do not invent sale/rental or publication metadata; selecting those criteria excludes examples without that information. Result cards remain on the right and the filter popover can be opened independently of Operation.

### Intro shown once

An enabled agency intro plays only until it has been shown in the same browser. Successful playback (`playing`) or explicit continuation records a local flag scoped to the canonical agency ID and video URL. Returning to the panel or reloading does not replay it. Another agency or a changed video URL has its own first viewing. Clearing browser storage also clears the history. If storage is blocked, the app remembers only for its current in-memory lifetime; entry never fails because storage is unavailable. Disabled/embedded intros and legacy shared videos retain their behavior.
