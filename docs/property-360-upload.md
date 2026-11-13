# Property 360° upload scaffold

`Property360Upload` is a client-side local panorama draft. It renders no form and its file input has no `name`, so saving the surrounding property form does not submit the selected image. A parent can embed it with an optional existing `propertyId` and `disabled` capability flag.

## Local preview

- Accepts JPEG, PNG and WebP files from 1 byte through 20 MiB.
- Requires equirectangular dimensions approximately 2:1 (ratio 1.9–2.1), with at most 8192 pixels per side and 33,554,432 total pixels. Dimensions are inspected after browser image decoding; these are preview limits, not server-side validation.
- Dynamically loads the existing interactive `Panorama` viewer with SSR disabled, only after successful validation. The viewer receives the selected object URL and an explicit local-preview label; it never opens the viewer's remote demo fallback.
- Replacing/removing the selection, changing the property/editing capability, or unmounting revokes the object URL and aborts any adapter request. Stale decode/upload callbacks cannot restore an old selection. Cancelling the file picker preserves the current selection.
- The selected file is a volatile draft: it is not retained after leaving the editor and is not saved by the surrounding property form.

## Future hosting integration

Without `uploadAdapter`, the component makes no upload/network request. The upload control is disabled with a configuration explanation and the local-only warning remains visible. No provider, paid API, credentials or account is configured.

The optional `Tour360UploadAdapter` type in `lib/properties/tour360-upload.ts` receives `{ propertyId, file, signal }` and resolves to `{ url }`. An existing property ID and a validated local selection are required before invoking it. Successful URLs must use HTTPS and must not contain embedded credentials. Completion reports only that a host upload finished, **not** that the panorama was associated with the property. The caller's adapter owns the resulting resource and any later explicit association workflow; the component does not submit a hidden resource URL or persist property data.

Before wiring a real host, implement authenticated server-side agency ownership checks, content/signature and dimension/byte validation, authorization-bound resource keys, cancellation/orphan cleanup, and an explicit authorized persistence step. Client validation and an HTTPS URL do not establish ownership, content safety or persistence. Aborting a request cannot guarantee that a remote host did not store a resource; reconcile its state before retries.

## Verification

`node --experimental-strip-types --test tests/property-360-upload.test.mjs` tests policy helpers and actual component handlers using mocked React hooks, Image, object URLs, Panorama and adapters without browser/network access. The legacy viewer label defaults remain covered. Run `tsc --noEmit --incremental false` for integration typing; the parent owns full-suite and form integration checks.
