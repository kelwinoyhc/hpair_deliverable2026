# Design notes

A record of what this application does, how it is put together, and why each
choice was made over the alternative. Written to be argued with.

---

## 1. What the starter repo contained

Worth stating, because most of the early decisions are reactions to it.

- `MultiStepForm.js` carried `// TODO: Implement form validation using Formik and Yup`.
  Formik and Yup were in `package.json` but imported nowhere.
- One step existed (first name, last name, date of birth, gender). **None** of the
  required fields — address, CV, phone, nationality, LinkedIn, preferred language —
  were built.
- A Firebase project's credentials were committed in `src/firebase/config.js`, with
  an email/password login gating the form and an admin panel listing submissions.
- `node_modules/` (51,890 files) and `build/` were committed, and there was no
  `.gitignore`.

### The Firebase decision

The committed credentials pointed at a live project, `hpair-deliv-6443a`, which
shipped with the starter repo — so every applicant who forked it received the same
keys and wrote into the same database.

Two things followed from reading `firebaseService.js`:

```js
// firebaseService.js, as shipped
const q = query(collection(db, COLLECTION_NAME), orderBy('submittedAt', 'desc'), limit(limitCount));
```

The query had no `where` clause, so it returned **every** applicant's submission.
The narrowing to the current user happened afterwards, in the browser:

```js
// MultiStepForm.js, as shipped
const userSubmissions = submissionsResult.data.filter(
  (submission) => submission.userId === userId
);
```

Filtering in the client is presentation, not access control. The unfiltered
response — including other applicants' addresses and phone numbers — was visible
to any registered user in DevTools.

So writing real personal data there was not an option. The alternatives were:

| Option | Why not chosen |
| --- | --- |
| Use the shipped Firebase project | Writes personal data to a database other applicants can read, and the deployed demo depends on a project I don't control staying as it is. |
| Create a private Firebase project | Sound, and the natural next step. Rejected here because it puts the demo behind console configuration (enabling a provider, publishing rules) that a reviewer cannot see or verify from the repo. |
| **No backend; one submission module** | **Chosen.** Nothing to configure, the deploy cannot break because of someone else's settings, and no personal data leaves the browser. |

The cost is real and is not hidden: **submissions do not persist server-side.**
What makes that acceptable rather than a dodge is that the seam is explicit —
`src/services/submissionService.js` is the only module that knows submission
exists, and it returns the same result shape a real transport would:

```js
const result = await submitApplication(values);
if (result.ok) { /* result.receipt */ } else { /* result.error */ }
```

Replacing the simulated call with `fetch`, Firestore, or a Vercel serverless
route is a change to one function. No component knows the difference.

---

## 2. Architecture

```
src/
  App.js                        Shell: header, skip link, layout
  components/
    MultiStepForm.js            Wizard state, step gating, submit handling
    StepIndicator.js            Progress nav
    FormFields.js               TextField / SelectField / RadioGroup / CheckboxField
    CvUpload.js                 Dropzone bound to Formik
    Confirmation.js             Post-submit receipt + download
    steps/                      One presentational component per step
  validation/
    schemas.js                  Yup schemas, one per step + a combined schema
    schemas.test.js             34 tests on the rules themselves
  services/
    submissionService.js        The submission boundary (see §1)
  hooks/useAutoSave.js          Debounced localStorage persistence
  utils/summary.js              Values -> display sections (review + download)
  data/options.js               Country and language options
```

The organising idea: **validation rules, submission, and presentation are three
separate things.** Step components contain no rules and no transport. That is why
the rules can be tested in 2 seconds without rendering anything, and why the
review screen and the downloaded file cannot disagree — both call `buildSummary`.

### Why a wizard rather than one long page

The brief asks for ~18 fields including a file upload. In one column that is a
scroll with no sense of progress, and one validation failure can be off-screen.
Four steps of 4–8 fields give a progress indicator, a natural place for a review
screen, and per-step validation that only ever complains about what is on screen.

The cost: more state to manage (which step, how far the user has been, where to
send them when a field fails at the final gate) and the risk of skipping a step.
That last risk is why submission re-validates the **entire** form:

```js
await fullSchema.validate(values, { abortEarly: false });
```

Per-step gating should make this unreachable. It is there so that a bug in the
gating logic cannot produce a partial submission — it fails loudly and sends the
user back to the offending field instead.

### Why no router

`react-router-dom` was in `package.json` and is now removed. Position in a wizard
is state, not a location. Routing would mean either deep links that open mid-form
with nothing behind them, or route guards elaborate enough to make those links
unreachable — plus a `vercel.json` rewrite so refreshing `/step/2` doesn't 404.
None of it benefits the user here.

### Dependencies, and why each one stays

| Package | Justification |
| --- | --- |
| `formik` | Form state, touched-tracking, submission lifecycle. Hand-rolling `touched` correctly is more code than it looks. |
| `yup` | Declarative schemas that are testable in isolation and support `when()` for conditional fields. |
| `react-dropzone` | Drag-and-drop with keyboard and screen-reader support already handled. |
| `react-icons` | Icons without hand-inlining SVG. |

Removed: `firebase`, `react-router-dom`, `axios` (nothing makes HTTP requests),
`styled-components` (see §3). That took the gzipped bundle from ~131 kB to ~96 kB.

Added as **devDependencies** (not shipped): `@testing-library/react`,
`@testing-library/user-event`, `@testing-library/jest-dom`.

---

## 3. Styling and brand

Plain CSS with custom properties in `index.css`, not styled-components.

The starter shipped both a 340-line stylesheet and `styled-components` in
`package.json`. Running both means two sources of truth for what a button looks
like. The stylesheet won because the class names it already defined —
`.form-input`, `.btn`, `.step-indicator`, `.file-upload-area`, `.summary-section`
— describe exactly this form, and a single global sheet for a single-page app has
no runtime cost and no build-time setup.

Responsive behaviour is a single breakpoint at 640px. Paired fields collapse to
one column, the step indicator drops its text labels and keeps the numbered
circles, and buttons go full-width. Nothing is hidden that carries information.

### The palette is measured, not guessed

hpair.org runs on Squarespace, which exposes the site's theme as HSL custom
properties. Pulling its stylesheet gave the real values:

| Variable | Value | Hex |
| --- | --- | --- |
| `--accent-hsl` | `0, 88%, 21%` | `#650606` deepest crimson |
| `--darkAccent-hsl` | `353, 90%, 31%` | `#960819` crimson |
| `--black-hsl` | `40, 1%, 9%` | warm near-black |
| `--white-hsl` | `40, 0%, 99%` | warm near-white |

Two things came out of that beyond the crimson. The typeface is **Poppins**
(loaded with `display=swap` and a full fallback stack, so text never blocks on
the webfont). And the neutrals are *warm* — that 40° hue on the greys is why the
palette here uses warm greys throughout; a cool grey beside crimson reads as an
accident.

### The logo

An original inline-SVG mark: a crimson shield with three bars abstracting the
three books of the Harvard arms, beside the wide-tracked two-line uppercase
lockup that is the distinctive part of the HPAIR banner.

It deliberately does **not** reproduce Harvard's VERITAS crest, which is a
registered mark. Inline SVG over an image file because it stays crisp at any
size, the words remain selectable and readable by screen readers, and it costs no
network request. To use HPAIR's official asset instead, drop the PNG in `public/`
and swap the `<svg>` for an `<img>` — the surrounding typography carries the
identity either way.

### A conflict worth naming: crimson is both the brand and the error colour

If invalid fields are tinted red on a crimson-branded page, "error" and "brand"
become the same signal. Two things resolve it:

1. The error red is shifted warm and lighter (`#b5341f`) so it is visibly not the
   brand crimson.
2. **Every error carries an alert icon**, so an error is identified by shape, not
   hue. This is also what WCAG 1.4.1 requires — colour must never be the only
   means of conveying information.

### Contrast was measured, and two values failed

Every foreground/background pair was checked against WCAG AA (4.5:1 for body
text). Two of my first choices failed and were corrected:

- `--ink-faint` at `#78716b` measured **4.42:1** against the page canvas, which
  the footnote sits on. Darkened to `#746d67` (4.68:1).
- The placeholder grey `#a8a099` measured **2.58:1**. Placeholders are text and
  WCAG makes no exception for them, so it was darkened to `#7d756e` (4.52:1). The
  risk of a darker placeholder is that it reads as a filled value; that is
  acceptable here only because every field has a visible label above it and no
  placeholder is ever the sole statement of what a field wants.

The rest clear AA comfortably — white on the crimson masthead is 9.65:1, body ink
on white is 17.69:1.

---

## 4. Requirements, and where each is implemented

### Real-time validation
`validateOnChange` and `validateOnBlur` are on, so errors appear and clear as the
user types. An error is only shown once a field is `touched`, so a pristine form
is not covered in red before anyone has typed.

`Next` is disabled only once the current step has a **visible** error — not while
the form is merely incomplete. A disabled button on a pristine form gives the user
nothing to act on; an enabled one that reports what is missing does.

### Two message-ordering bugs the tests caught
Both were found by writing tests, and both are the reason the test file exists.

**1. Format messages pre-empting "required".** Yup reports failures in the order
they are chained, and Formik displays the first. With `.min(2).required()`, an
empty "First name" read *"must be at least 2 characters"* — true, but not what an
empty field should say. Fix: chain `.required()` first everywhere, and give every
regex `excludeEmptyString: true`.

**2. An empty date claiming to be invalid.** An empty `<input type="date">` is
`''`, which `Yup.date()` casts to an Invalid Date — and a failed cast
short-circuits every other check, so the field read *"Enter a valid date."*
instead of *"Date of birth is required."* Chain order cannot fix this, because the
cast runs first. Fix:

```js
.transform((value, originalValue) => (originalValue === '' ? undefined : value))
```

`''` becomes `undefined`, `required` fires, and genuine nonsense still reports a
format error. Both behaviours are pinned by tests.

### Field choices
- **Phone** — E.164 (`^\+[1-9]\d{6,14}$`). Unambiguous, storable as typed, no
  dependency. Rejected `libphonenumber-js` (~145 kB for per-country formatting
  this form doesn't need). The trade-off is that the user must type a country
  code, so the label says so and the error gives an example.
- **Postal code** — shape-checked, not country-specific. Formats vary enormously
  and some countries have none; a strict per-country table would reject valid
  addresses, which is the worse failure.
- **Country / nationality / language** — ISO codes stored, display names resolved
  at runtime with `Intl.DisplayNames`. The submitted value is a stable `"JP"`
  rather than a display string that would break under localisation.
- **CV** — PDF/DOC/DOCX, 5 MB. Enforced in the Yup schema so a too-large file
  produces an error in the same place and style as a bad phone number. The
  dropzone's own limits are a UX nicety; the schema is the gate.

### Fields added beyond the brief
Email (a form with no reply address is not actionable), a structured address
rather than one free-text box (sortable, and it validates), current role, and an
explicit consent checkbox before submission.

### Accessibility
Written once in `FormFields.js` so it cannot drift per field: `label`/`for`
association, `aria-invalid` on failure, `aria-describedby` pointing at both hint
and error, `role="alert"` on error text, radios in a `fieldset` with a `legend`.
Beyond the fields: a skip link, `aria-current="step"` on the progress nav, focus
moved to the step heading on change and to the confirmation heading after submit,
focus sent to the first invalid field on a failed `Next`, a single
`:focus-visible` treatment throughout, and `prefers-reduced-motion` honoured.

---

## 5. Bonus features

- **Auto-save.** Debounced at 600 ms (a `JSON.stringify` per keystroke buys
  nothing). The `File` is deliberately excluded — `File` objects are not
  serialisable and a page cannot re-attach a file the user didn't just choose. The
  filename is kept so the UI can say *"you previously attached ada-cv.pdf, please
  attach it again"* rather than appearing complete with nothing attached. On
  return, answers are restored with a visible notice and a "start over" escape.
- **Loading state.** Spinner and disabled button while in flight.
- **Inline notifications.** Per-field errors, a draft-restored notice, a
  "progress saved" indicator, and a submission error banner in an `aria-live`
  region.
- **Keyboard navigation.** `Enter` advances the wizard rather than submitting from
  step 1; only the review step's `Enter` submits. Completed steps in the progress
  nav are focusable buttons; steps ahead are disabled.
- **Conditional questions.** LinkedIn (the brief's example) and a self-description
  field when someone selects "prefer to self-describe". Rendering is driven by the
  same value the schema branches on, so the field shown and the field validated
  cannot disagree. `.strip()` removes a declined field from the payload entirely,
  so no stale value is submitted.
- **Downloadable summary.** JSON, built from the same `buildSummary` the review
  screen uses. Chose JSON over a PDF: no dependency, and it is exactly what a
  backend would receive. A print-styled page would look nicer and is a different
  feature.
- **Review step** with per-section "Edit" jumps.
- **Reference code** on the confirmation screen — "submitted successfully" with
  nothing to quote is not much use if the applicant later needs to ask about it.

### One subtle choice: `sessionStorage` for the receipt
The draft lives in `localStorage`; the receipt lives in `sessionStorage`. A
refresh on the confirmation screen should still show the receipt, but someone
returning a week later should land on a fresh form — not a stale "you already
submitted" screen they cannot get past. Different lifetimes, different stores.

---

## 6. Testing

50 tests across two files. Run with `npm test -- --watchAll=false`.

- `validation/schemas.test.js` (34) — the rules directly. Pure, fast, and where
  the actual decisions live: what counts as a phone number, when LinkedIn becomes
  required, the two ordering bugs in §4.
- `components/MultiStepForm.test.js` (16) — behaviour not expressible in a schema:
  that you cannot advance past an invalid step, that errors never appear for a step
  you haven't reached, that conditional fields appear and disappear, that
  submission shows a loading state and then a confirmation, that a failure keeps
  you on the form with your draft intact.

Writing them was not ceremony — they caught the two message-ordering bugs and an
unguarded `scrollIntoView` that would have thrown on any browser lacking it.

---

## 7. Known limitations

Stated rather than discovered later:

1. **No server-side persistence.** §1. The seam is one function.
2. **The uploaded file is never transmitted.** Its name, size, and type are
   recorded; contents are not read. A real implementation needs multipart upload
   or a signed URL.
3. **No email delivery.** The brief lists it as a bonus; it needs a backend to be
   anything other than theatre. Not faked.
4. **Client-side validation only.** Fine for UX, never sufficient for trust — any
   real endpoint must re-validate. `fullSchema` is written to be shared with a
   Node backend unchanged.
5. **English only.** The form asks for a preferred language and then ignores it.
   `Intl.DisplayNames` and ISO codes are the groundwork, not the feature.
6. **A draft is per-browser**, not per-user; on a shared machine the next person
   sees it. Real accounts would fix this, at the cost of §1.

---

## 8. Running it

```bash
npm install
npm start                          # dev server
npm test -- --watchAll=false       # 50 tests
CI=true npm run build              # exactly what Vercel runs
```

`CI=true` matters: Vercel sets it, and it turns ESLint warnings into build
failures. An unused import passes locally and fails the deploy, so verify with the
flag before pushing.

**Demoing the error state:** submit with an email beginning `fail@` and the
service returns a failure. Deterministic on purpose — a random failure is
indistinguishable from a bug to whoever is reviewing it.

### Deployment
Static CRA build, no environment variables, no serverless functions, no
`vercel.json`. Vercel detects Create React App, runs `npm run build`, serves
`build/`. Nothing to configure, which is the point.
