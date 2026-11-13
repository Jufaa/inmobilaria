# Property WhatsApp contact

## Configure a property

Open **Propiedades**, find the saved property's card and expand **WhatsApp de esta propiedad**. Enter a full international number (for example `+54 9 358 1234567`) and the message visitors should start with, then choose **Guardar WhatsApp**. Use **Quitar WhatsApp** to remove the public contact link.

The message supports `{propiedad}` and `{enlace}`. The property's title and canonical public link are included automatically even when those placeholders are omitted. The number is intentionally visible to visitors, so use the agency's business contact number.

Contacts can be prepared for drafts, but the public CTA/preview appears only for published properties. A card without a photo or WhatsApp contact does not acquire fabricated contact information.

## Visitor experience

The property detail offers **Consultar o coordinar visita por WhatsApp**. It opens the selected number with the agency's message and current-origin property URL ready in WhatsApp. The visitor confirms sending there; the application does not send automatically or create a booking. Existing inquiry forms remain the fallback when no WhatsApp contact is configured.

This uses WhatsApp click-to-chat (`https://wa.me/<international digits>?text=...`), not a paid messaging API or a hosted scheduling service. Reference: https://faq.whatsapp.com/5913398998672934 . No external account is provisioned by this feature.

## Permissions and persistence

Only OWNER/ADMIN members of the property's owning agency, or the authoritative system administrator, can edit its WhatsApp contact. A presenting/sharing agency cannot edit or replace the owner's contact. Editors, unrelated accounts and visitors cannot save contact settings. The contact editor remains independent from advanced map/template permissions. Catalogue, photo, appearance and offer permissions now follow the scoped agency self-service policy described in agency-basic-settings.md; they do not grant general system configuration access.

Contacts are optional data in the existing agency presentation JSON. Legacy settings retain their shape when the field is absent; no migration is required. Serializable updates retry bounded write conflicts and preserve unrelated contacts/settings. General presentation saves retain the latest server-side contacts rather than overwriting them with a stale client draft.

Public details return only the selected published property's validated owner contact, never the whole agency contact map. Link origin comes from the actual browser origin, not a submitted host field. Link generation/preview does not validate whether a number is registered with WhatsApp and does not send a test message.

## Verification limits

Automated tests use isolated mocked persistence and cover permission, ownership, parsing, link encoding, retry/preservation and UI wiring. A real database save and a real WhatsApp conversation require an authorized browser/integration check. No such remote operation is part of this implementation.
