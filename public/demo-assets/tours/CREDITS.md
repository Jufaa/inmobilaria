# Demo video credits

The video tour is now integrated into the **private agency panel map** at
`/inmobiliaria/[agencyId]/panel`, behind the existing dashboard access check.
This is a local customer presentation, not a production launch. The standalone
`/recorridos` and `/recorridos/mapa` pages and their public navigation links have
been removed. Shared footage and interactive tour components remain available
to the panel; no agency records are created or modified.

## Panel aerial presentation

After signing in, open an agency's map. The customer presentation starts with
an optional 24-second institutional sample. Skip it to see the general Río Cuarto
overview. Select Centro or Banda Norte to play the corresponding six-second zoom
sample, then enter the interactive Google aerial zone. Skip/back controls remain
available if a video cannot play. Missing or disabled clips enter the next stage
directly. The map remains mounted when returning from a zone or replaying the
institutional introduction.

Each zone has six explicitly fictional properties. Select a property to open its
interior directly by default, or enable its optional drone/entrance clip from
Personalización. Existing standalone tours preserve their original entrance-first
behavior. Returning from an interior keeps the aerial camera mounted.

Personalización includes browser-local, agency-scoped controls for introduction,
zone transitions, per-property drone playback, map colors, up to fifty geographic
POIs, and a custom map image. Custom images can be supplied as public HTTPS/local
URLs or PNG/JPEG/WebP uploads up to 2 MB. Geographic image bounds must match the
artwork so zone/POI overlays align; aspect-ratio letterboxing is respected. Custom
artwork and transition clips can be prepared with AI or another external editor;
there is no integrated AI generation service or paid API invocation. Neither AI
artwork nor stock footage verifies facts about a real property.

New presentation settings use `territorio-agency-presentation-v1:<agency-id>` in
localStorage. They are separate for each agency and remain on this browser only,
not shared across users/devices. Existing branding persistence, access checks,
agency-scoped queries and real records are unchanged. No sample is published to
the public catalogue. The existing shared-map consumer keeps its previous
behavior when optional presentation inputs are absent.

### Demo key setup

Create a [Maps Demo Key](https://developers.google.com/maps/demo-key) yourself,
accepting the demo terms without attaching billing. Store it in ignored
`.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, then restart `pnpm dev`.
The browser-visible key is not printed by application messages or tests. No
account, billing, upgrade or key-provisioning API is called by this application.
The SDK loads lazily, only after entering a zone; maps3d imports are shared across
concurrent mounts. Failed loads time out and may be retried.

[Google's demo documentation](https://developers.google.com/maps/demo-key)
limits this key to prototyping; reaching its daily cap pauses use rather than
charging for excess use. Production requires a separate account/billing decision.
The application cannot determine from a key string whether the account uses demo
or standard billing, and does not certify the user's billing settings.

The aerial scene uses Google's SATELLITE 3D mode, with numbered interactive
markers and top-down/tilted camera controls. Rendering and photorealistic detail
depend on Google's geographical coverage, the key's permissions/quota and browser
3D support. **Río Cuarto photorealistic coverage has not been visually verified.**
Errors remain explicit; sample MP4s never masquerade as the aerial view. Property
buttons still allow entrance-tour testing when aerial rendering fails.

### Fictional fixtures and configuration

Six sample markers are generated in memory for the selected panel zone. They are
illustrative positions, not surveyed houses or real listings. The two editable
browser templates are reused across zones; each presentation chooses one
consistently by its zone ID and uses that template's entrance/interior videos and
price. These are not six unique property surveys. Attribution remains below.

The advanced shared-template editor retains title/description/location/price,
interior and entrance media, poster and ordering controls. It keeps the unchanged
`territorio-tour-config-v1` localStorage format, separate from the new per-agency
presentation settings. Opening or resetting a draft does not persist it; an
explicit successful save is required. Invalid input, quota errors and unavailable
storage preserve the prior saved data and present an error. Known Centro/Banda
Norte templates retain their intended footage even after reordering.

Production deployment, billing setup, actual property-video uploads, and alignment
between a real building and its own interior footage are separate future work.

## Sources

| Footage | Creator | Source |
| --- | --- | --- |
| Apartment building, drone orbit | Marc Espejo | https://www.pexels.com/video/aerial-view-of-modern-urban-apartment-complex-32629711/ |
| Minimalist living room, apartment 01 | Abdullah \| 4K | https://www.pexels.com/video/modern-minimalist-living-room-10135156/ |
| Bright living room, apartment 02 | Max Vakhtbovych | https://www.pexels.com/video/a-modern-living-room-7533207/ |

License: https://www.pexels.com/license/ (checked 2026-10-21).

The Pexels license permits modification and website/app use. No endorsement by
creators or depicted property owners is implied.

## Local derivatives

- `entrance-01.mp4` and `entrance-02.mp4`: separate exterior sections followed by
  the respective interior clip, with a 0.5-second dissolve. These are edited
  sample transitions, not continuous camera flights through the same building.
- `interior-01.mp4` and `interior-02.mp4`: distinct nine-second interior excerpts.
- `building.jpg` and `interior-0{1,2}.jpg`: poster frames extracted from the clips.
- Videos are silent H.264, 1280 x 720, 25 fps, YUV420p with MP4 fast-start.

The exterior and the two interiors are unrelated stock locations, not verified
Río Cuarto listings. Property positions, listing facts, existing generated
photos, spherical panorama, and floor plan are illustrative. The panorama is
not a scan of either stock-video interior.

### Additional customer-presentation samples (2026-10-23)

- `agency-intro-sample.mp4`: a 24-second looped derivative of the existing
  `entrance-01.mp4`, explicitly watermarked as an institutional example. Replace
  it with the agency's real presentation; it is not a finished brand video.
- `zone-centro-transition.mp4` and `zone-banda-norte-transition.mp4`: six-second
  illustrative zoom videos authored from the repository's existing
  `public/maps/rio-cuarto/reference-map.webp`, using its configured reference
  bounds. These are not recordings of Google Maps 3D, drone flights or generated
  photorealistic reconstructions. Source-map provenance remains that of the
  supplied repository asset; no new imagery was downloaded. The customer can
  replace both videos with prepared transitions matching their own map artwork.
