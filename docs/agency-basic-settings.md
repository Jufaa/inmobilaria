# Agency-owned colors and offers

An agency OWNER or ADMIN can change basic colors and offers for their own agency. Global app owners retain the advanced personalization editor. EDITOR and AGENT memberships do not gain these write permissions.

## Use the panel

Agency users see only **Operación**: basic Personalización and Ofertas are grouped there. The system administrator sees both Operación and Administración and all links regardless of agency membership navigation flags. Visitors use public search/property/WhatsApp pages without these internal menus.

1. Open **Personalización** to choose the agency primary color, property-card background/text, or property-type colors. The primary color previews immediately; its save is separate from the map palette save.
2. Open **Ofertas**, select a resolved property, and save an explicit offer price/currency. Fictional targets are labeled **Ejemplo ficticio**. Offers do not change catalogue prices.

Supported property types are Casa, Departamento, Dúplex, PH, Lote, Local and Otro. Basic editors do not receive map geometry, template, introduction/media or advanced identity controls.

## Persistence boundaries

- Every write uses `requireAgencyBasicEditAccess` and the canonical agency ID returned by that guard, never a submitted tenant ID.
- Brand persistence updates only `agency.brandPrimaryColor`; logo, cover and welcome media remain global-only.
- Palette persistence accepts only popup colors and supported type-color entries. Extra advanced fields are ignored, not persisted.
- Offers persistence accepts an offers array only. Targets are resolved from the agency's real records and configured fictional examples using `agencyOfferTargets`; arbitrary IDs and mismatched sources fail validation.
- Palette and offers patch the latest canonical settings through the existing Serializable/retry helper. They preserve independent WhatsApp contacts, map geometry, listings, presentation media and unrelated configuration. Invalid existing settings fail without replacing them with defaults.
- `canManageBasic` controls navigation only. The global `WorkspaceEditPermissionProvider` still receives the unchanged global `canEdit` flag; collaboration and finance retain their existing guards.

## Verify

```sh
node --experimental-strip-types --test tests/agency-basic-settings.test.mjs tests/agency-basic-appearance.test.mjs tests/offers-ui.test.mjs tests/personalization-panels.test.mjs tests/panel-brand-theme.test.mjs
npx tsc --noEmit --incremental false
```
