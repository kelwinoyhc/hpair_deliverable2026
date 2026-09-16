# Interview prep

The AI policy says every design decision and trade-off is fair game. This file is
the walkthrough: what exists, why, and the questions most likely to come at you.

**Reading this is not the same as understanding the code.** For each section there
is a file named. Open it. If you can't answer a drill question without looking at
the answer, that file is your homework.

---

## Contents

1. [The 60-second answer](#1-the-60-second-answer)
2. [What's in the repo](#2-whats-in-the-repo)
3. [How a submission actually flows](#3-how-a-submission-actually-flows)
4. [The seven decisions you must be able to defend](#4-the-seven-decisions-you-must-be-able-to-defend)
5. [Bugs found along the way](#5-bugs-found-along-the-way) ← your strongest material
6. [Drill questions](#6-drill-questions)
7. [The traps](#7-the-traps)
8. [Homework](#8-homework)

---

## 1. The 60-second answer

When they say *"walk me through what you built"*:

> It's a four-step — five with review — delegate application form. React with
> Formik for form state and Yup for validation, Supabase for persistence,
> deployed on Vercel.
>
> Three things I'd point at. First, validation lives in its own module, one schema
> per step, so the rules are testable without rendering React and the wizard can
> validate only the fields on screen. Second, the starter shipped Firebase
> credentials for a project shared by every applicant, and its read query returned
> everyone's submissions and filtered by user in the browser — so I replaced it
> with Postgres and Row Level Security, where the database refuses the row rather
> than the front-end declining to draw it. Third, the admin counts run as
> `count(*)` in Postgres against generated columns, so "how many invitation
> letters do we owe" is one small request instead of downloading every application
> to count them in JavaScript.
>
> 107 tests. Two of them exist because they caught bugs in my own validation
> messages.

Then stop and let them pick a thread. Don't recite the rest.

---

## 2. What's in the repo

~2,600 lines of source, ~1,140 lines of tests, 101 kB gzipped bundle.

### Runtime dependencies — four, and why each survives

| Package | One-sentence justification |
| --- | --- |
| `formik` | Form state, touched-tracking, submission lifecycle. Tracking `touched` correctly by hand is more code than it looks. |
| `yup` | Declarative schemas, testable in isolation, with `when()` for conditional fields. |
| `react-dropzone` | Drag-and-drop with keyboard and screen-reader support already solved. |
| `react-icons` | Icons without hand-inlining SVG. |

**Removed from the starter:** `firebase`, `react-router-dom`, `axios` (nothing
makes HTTP calls), `styled-components` (see §4.4). That took the bundle from
~131 kB to ~96 kB before later features brought it to 101 kB.

**Dev only** (not in the bundle): `@testing-library/react`, `/user-event`,
`/jest-dom`.

### File map

```
src/
  App.js                        Shell, masthead, hash route (form vs admin)
  index.css                     All styling. Design tokens at the top.

  components/
    MultiStepForm.js      299   Wizard state, step gating, submit handling
    FormFields.js         281   TextField, SelectField, RadioGroup,
                                CheckboxField, TextAreaField, CheckboxGroup
    CvUpload.js           146   Dropzone bound to Formik
    Confirmation.js        94   Receipt, download, focus management
    StepIndicator.js       48   Progress nav
    BrandMark.js           57   Inline-SVG HPAIR lockup
    steps/                      One presentational component per step
    admin/AdminView.js    195   Submissions table, counts, CSV export
    admin/AdminGate.js     93   Passcode prompt (NOT security — §4.7)

  validation/
    schemas.js            285   Five Yup schemas + the combined one
    schemas.test.js             25 blocks / 34 tests

  services/
    submissionService.js  101   The submission boundary
    submissionStore.js     63   localStorage archive the admin view reads

  hooks/
    useAutoSave.js         69   Debounced draft persistence
    useHashRoute.js        26   The only routing

  utils/
    summary.js            125   Values -> display sections (review + download)
    adminRows.js           88   Table columns + CSV, with injection guard
    phonePrefill.js        47   Dial-code prefill rule (pure)

  data/
    options.js             92   Countries, languages, proficiency, genders
    dialCodes.js           50   ISO country -> calling code
```

**The organising idea, if asked:** validation rules, submission, and presentation
are three separate concerns. Step components contain no rules and no transport.
That's why the rules test in ~2 seconds without rendering anything, and why the
review screen and the downloaded file can't disagree — both call `buildSummary`.

---

## 3. How a submission actually flows

Be able to trace this end to end. It's the most likely "explain your
architecture" follow-up.

```
User types
   -> Formik holds values in state
   -> validateOnChange runs STEP_SCHEMAS[step] (only this step's fields)
   -> FormFields shows an error if the field is touched AND invalid
   -> useAutoSave debounces 600ms, writes values (minus the File) to localStorage

User presses Next
   -> validateForm() with the current step's schema
   -> any errors? mark only THIS step's fields touched, focus the first bad one
   -> no errors? advance, move focus to the new step heading

User presses Submit (review step)
   -> fullSchema.validate(values) — the whole form, as a final gate
   -> failure? jump back to the step owning the first bad field
   -> success? submitApplication(values)
         -> 900ms simulated latency
         -> builds a receipt: reference, timestamp, answers, attachment metadata
         -> addSubmission() -> Supabase insert, AND localStorage
              remote write failed? receipt is flagged undelivered and the
              confirmation says so, rather than implying success
         -> saveReceipt()   -> sessionStorage  (this tab's confirmation)
   -> clearDraft(), render Confirmation, move focus to its heading
```

Two details worth knowing cold:

- **The File never leaves the browser.** Only its name, size and MIME type are
  recorded. Supabase Storage would hold the actual PDF; that's the next step.
- **Writes go to both tiers.** Supabase is the record; localStorage exists so the
  app runs without credentials (a fresh clone, and the whole test suite) and so a
  network failure doesn't discard someone's answers.
- **Receipt is `sessionStorage`; draft is `localStorage`.** Deliberate: a refresh
  on the confirmation screen should still show it, but someone returning next week
  should land on a fresh form, not a stale "you already submitted" screen.

---

## 4. The seven decisions you must be able to defend

### 4.1 No backend, and submission behind one module

**The situation.** The starter committed real Firebase credentials for project
`hpair-deliv-6443a`, shipped to every applicant who forked the repo. Reading
`firebaseService.js`:

```js
// as shipped — no where() clause, so this returns EVERY applicant's submission
const q = query(collection(db, COLLECTION_NAME), orderBy('submittedAt', 'desc'), limit(limitCount));
```

The narrowing to the current user happened afterwards, in the browser:

```js
// MultiStepForm.js, as shipped
const userSubmissions = submissionsResult.data.filter((s) => s.userId === userId);
```

**Filtering in the client is presentation, not access control.** The unfiltered
response — other applicants' addresses and phone numbers — was in the network tab
for any registered user to read.

**What I did.** Replaced it with Supabase, where the decision lives in Postgres:

```sql
create policy "only the admin may read submissions" on public.submissions
  for select to authenticated
  using (auth.jwt() ->> 'email' = 'admin@example.com');
```

Now the client *cannot* obtain another applicant's row however it's modified,
because the database refuses it. **A filter in the client is presentation; a
policy in the database is enforcement.** That sentence is the single most useful
thing in this file.

**Follow-up you should expect: "isn't the anon key in your bundle?"**
Yes, and that's by design — it identifies the project, it doesn't authorise
anything. All the protection is in the policies. Which is exactly what the starter
lacked: it had credentials *and* a login and still leaked everything.

**The cost, stated:** `@supabase/supabase-js` is ~60 kB gzipped and took the
bundle from 101 kB to 161 kB. I could have hand-rolled `fetch` against PostgREST
in ~80 lines with no dependency. Say that before they say it.

### 4.2 A wizard, not one long page

19 fields including a file upload. In one column that's a scroll with no sense of
progress and validation failures off-screen. Four steps of 4–8 fields give a
progress indicator, a natural review screen, and per-step validation.

**The cost:** more state, and the risk of skipping a step. Which is why submit
re-validates the *entire* form — per-step gating should make that unreachable, so
it's there to make a bug in the gating loud instead of silently producing a
partial submission.

### 4.3 No router

Position in a wizard is state, not a URL. Routing would mean either deep links
that open mid-form with nothing behind them, or guards elaborate enough to make
those unreachable — plus a `vercel.json` rewrite so refreshing `/step/2` doesn't
404.

The admin view needed *some* address, so it's a hash: `/#admin`. Costs no
dependency, needs no rewrite, can't 404 because the server never sees a fragment.
**Trade-off:** worse deep linking and analytics. Fine for one internal view.

### 4.4 Plain CSS, not styled-components

The starter shipped both a 340-line stylesheet *and* `styled-components` in
`package.json`. Running both = two sources of truth for one button. The
stylesheet won because the class names it already defined (`.form-input`, `.btn`,
`.step-indicator`, `.file-upload-area`, `.summary-section`) describe exactly this
form, and one global sheet for one page has no runtime cost.

### 4.5 E.164 for phone — and then mitigating it

`^\+[1-9]\d{6,14}$`. Unambiguous, storable as typed, no dependency. Rejected
`libphonenumber-js` (~145 kB for per-country formatting this form doesn't do).

**The cost was real:** the user has to type `+81`. So the form now supplies it —
pick Japan and the field becomes `+81`. The rule is a pure function
(`utils/phonePrefill.js`) with one guarantee: **it never overwrites a number you
typed.**

The subtle part: `+1234` is *not* treated as a stale prefill, because it isn't any
country's dialling code — so it must be someone mid-typing. The check tests
against the real code list, not a `/^\+\d+$/` pattern.

### 4.6 Validation in its own module

`STEP_SCHEMAS` is indexed by step, so the wizard validates only what's on screen.
`STEP_FIELDS` says which fields belong to which step, which is how "mark only this
step's fields as touched" and "jump to the step owning the first bad field" both
work.

Keeping it out of the components means the rules test in ~2 seconds with no
rendering. That's why 34 of the 107 tests are pure schema tests.

### 4.7 The admin view, and where its security actually lives

`/#admin`. Sign in with Supabase Auth using the admin email.

**The point to make:** the sign-in form is not what protects the data. Delete
`AdminGate.js` entirely and not one row becomes readable, because the RLS policy
matches no rows for a non-admin JWT. The component is a convenience for the
admin, not a barrier for anyone else.

Ask yourself the question they'll ask: *"what happens if I open DevTools and call
`supabase.from('submissions').select()` myself?"* Answer: you get an empty array.
Not an error — a policy shouldn't confirm that rows exist to someone who can't
read them.

**There's still a fallback passcode**, used only when no Supabase project is
configured, so a fresh clone runs. That mode says on screen that it isn't
security, and a test asserts the warning is still there. Be able to explain why
both modes exist: the app must not require secrets to run locally.

**Also worth knowing:** there's no update or delete policy, so applications can't
be edited or removed from the browser at all. The UI offers no delete button, and
a test asserts it doesn't — a UI that offers an action the database will refuse is
worse than one that doesn't offer it.

---

## 5. Bugs found along the way

Lead with these if asked "what was hard?" or "what did you learn?". Finding a bug
in your own work and fixing it properly is the most convincing thing you can show.

### 5.1 Format errors pre-empting "required" *(caught by a test)*

Yup reports failures in the order they're chained, and Formik shows the first. With
`.min(2).required()`, an empty "First name" read **"must be at least 2
characters"** — true, but not what an empty field should say.

**Fix:** chain `.required()` first everywhere, and give every regex
`excludeEmptyString: true`. Seven fields were affected. A parameterised test pins
all of them.

### 5.2 An empty date claiming to be invalid *(caught by a test)*

An empty `<input type="date">` is `''`, which `Yup.date()` casts to an Invalid
Date — and **a failed cast short-circuits every other check**, so the field read
"Enter a valid date." instead of "Date of birth is required."

Chain order can't fix this, because the cast runs before any test:

```js
.transform((value, originalValue) => (originalValue === '' ? undefined : value))
```

`''` becomes `undefined`, so `required` fires, and genuine nonsense still reports
a format error. Both behaviours are tested.

### 5.3 Hooks inside Formik's render prop

I first wrote the wizard body as `<Formik>{(props) => ...}</Formik>` and called
`useAutoSave` inside it. Hooks in a render callback belong to the *parent's*
render — a rules-of-hooks violation that `CI=true` would have failed the Vercel
build on. Extracted `WizardBody` as a real component reading `useFormikContext()`.

**Worth knowing:** Vercel sets `CI=true`, which turns ESLint warnings into build
errors. An unused import passes locally and fails the deploy.

### 5.4 An error message that just repeated the hint *(caught by a test)*

The phone hint said "Include your country code." and the error said "Include your
country code, e.g. ...". A test failed with *"found multiple elements"* — which
exposed a real UX problem, not just a test problem. An error should add
information. Now: hint gives examples, error says "Enter the number in
international format."

### 5.5 Unguarded `scrollIntoView` *(caught by a test)*

`focusField()` called `target.scrollIntoView()`, which doesn't exist in jsdom or
some older browsers. Scrolling is a nicety — it must never be why focusing a field
throws. Now guarded.

### 5.6 Repo hygiene

`node_modules/` (51,890 files) and `build/` were committed with no `.gitignore`.
Untracked both. This had a real side effect: committing `node_modules` turned
npm's `.bin` **symlinks into plain text files**, so `npm start` failed until a
clean `npm ci`.

Also: `index.html` referenced a `favicon.ico` that wasn't in the repo (console
404), and `.file-list` lost its CSS rule in a rewrite.

### 5.7 Two contrast failures in my own palette

Every foreground/background pair was measured against WCAG AA. Two of my first
choices failed: `--ink-faint` at 4.42:1 against the canvas (the footnote sits on
it), and the placeholder grey at 2.58:1. Both darkened. Placeholders are text and
WCAG makes no exception for them.

### 5.8 CSV injection *(prevented, not found)*

A CSV field starting with `=`, `+`, `-` or `@` is a **formula** to Excel and Google
Sheets. An applicant could type `=HYPERLINK(...)` into the financial-aid text box
and have it execute when an administrator opens the export. Neutralised with a tab
prefix. Six tests cover it. The fields are typed by the public, so this is a live
path, not a theoretical one.

---

## 6. Drill questions

Cover the answer. Say it out loud. If you can't, open the file.

### React & architecture

**Q: Why Formik rather than `useState`?**
19 fields across 5 steps, each needing value, error and *touched* state, plus a
submission lifecycle. `touched` is the part people underestimate: errors must not
appear before a user has interacted, so you need per-field interaction tracking,
not just values. Formik also gives `validateForm()` on demand, which is what the
per-step gate uses.

**Q: Why is `WizardBody` a separate component instead of a render prop?**
Because it calls hooks. Hooks inside `<Formik>{() => ...}</Formik>` attach to
Formik's render, not a component of mine — a rules-of-hooks violation. It also
splits the file cleanly: `MultiStepForm` is state and submission, `WizardBody` is
layout. *(§5.3)*

**Q: In the phone prefill, why is `phone` read through a ref instead of being a
dependency?**
If `phone` were a dependency, the effect would re-run on every keystroke and fight
the user for control of the field. It should fire when the *country* changes.
The ref gives the effect the current value without making it reactive to it.

**Q: Why `setFieldValue('phone', next, false)`?**
The third argument skips validation. A bare `+81` isn't valid E.164, so validating
on write would show an error about a value the user hasn't had a chance to finish
typing.

**Q: Why does the auto-saved draft exclude the CV?**
`File` objects aren't serialisable, and a page can't re-attach a file the user
didn't just choose. So the filename is stored and the UI says *"you previously
attached ada-cv.pdf — please attach it again"* rather than appearing complete with
nothing attached.

**Q: Why is auto-save debounced?**
600 ms. Otherwise it's a `JSON.stringify` of the whole form per keystroke for no
benefit.

### Validation

**Q: Walk me through per-step validation.**
`STEP_SCHEMAS[step]` is passed to Formik as `validationSchema`, so only the current
step's fields are checked. On Next, `validateForm()` runs, and if it returns errors
for fields in `STEP_FIELDS[step]`, those fields — and only those — are marked
touched, and focus moves to the first one. A user never sees an error for a step
they haven't reached.

**Q: Then why re-validate everything on submit?**
Per-step gating *should* make it unreachable. It's a backstop: a bug in the gating
logic would otherwise produce a partial submission silently. Instead it fails
loudly and sends the user to the offending field.

**Q: What does `.strip()` do in the conditional branches?**
Removes the field from the validated output entirely. So if someone says they have
LinkedIn, types a URL, then changes to "no", the URL isn't submitted. Without it
you'd send a stale value from a path the user abandoned.

**Q: How is the file validated?**
In the Yup schema via `mixed().test()` — size and MIME type. Deliberately not in
the component, so a too-large file produces an error in the same place and style
as a malformed phone number. `react-dropzone`'s own `accept`/`maxSize` are a UX
nicety; the schema is the gate.

**Q: Explain the nested visa questions.**
Three levels: need a visa? → need an invitation letter? → full name as printed in
your passport. Each level's *rendering* reads the same value its schema branches
on, so what's shown and what's validated can't disagree. The passport name is
asked separately from step one's name because invitation letters get rejected when
the name doesn't match the passport exactly.

### Accessibility

**Q: How do you know it's accessible?**
The wiring is in `FormFields.js` so it can't drift per field: `label`/`for`,
`aria-invalid`, `aria-describedby` pointing at *both* hint and error, `role="alert"`
on error text, radios in a `fieldset` with a `legend`. Focus moves to the step
heading on change, to the first invalid field on a failed Next, and to the
confirmation heading after submit. Contrast was measured, not eyeballed — two
values failed and were fixed.

**Q: Why does every error have an icon?**
Because the brand colour is crimson and the conventional error colour is also red.
Tinting an invalid field in a near-brand colour makes errors ambiguous. The icon
makes an error identifiable by *shape*, not hue — which is what WCAG 1.4.1
requires: colour must never be the only signal.

### Security

**Q: Is the admin login secure?**
No, and it can't be. *(§4.7 — know this cold.)*

**Q: Where does validation need to be repeated?**
On the server. Client-side validation is UX; it can't be trusted, because the
client can be modified. `fullSchema` is deliberately written to be shared with a
Node backend unchanged.

**Q: What was wrong with the starter's Firebase setup?**
*(§4.1 — the strongest thing you can show.)*

### Testing

**Q: What did you test, and why that split?**
34 pure schema tests, because that's where the actual decisions live and they run
in seconds without rendering. 24 integration tests for behaviour a schema can't
express: you can't advance past an invalid step, errors never appear for unreached
steps, conditionals appear and disappear, submission shows loading then
confirmation, failure keeps you on the form with your draft intact. Plus 18 on the
CSV mapping and 11 on the admin view.

**Q: Did a test ever catch something real?**
Three things: the two message-ordering bugs (§5.1, §5.2), the hint/error
duplication (§5.4), and the unguarded `scrollIntoView` (§5.5). One test also
guards against drift — it asserts every country offered in the form has a dialling
code entry.

---

## 7. The traps

Questions where the honest answer is a limitation. **Volunteering these reads as
judgement; being caught by them reads as not knowing your own code.**

| They ask | Say |
| --- | --- |
| "Is the data saved anywhere?" | Yes — a Supabase Postgres table. Reads are restricted by an RLS policy, not by the front-end. |
| "Your anon key is in the bundle." | By design. It identifies the project; it authorises nothing. The protection is the policy. If RLS were off, the key alone would read the table — which is why the schema file ends with a query to verify RLS is on. |
| "What stops an applicant reading other applications?" | Postgres. The select policy matches only the admin's JWT email, so anyone else gets zero rows — including from the console. |
| "60 kB for a client library on a form?" | Fair. Hand-rolled `fetch` against PostgREST would be ~80 lines and no dependency. I took the library for auth session handling; I'd revisit it if bundle size mattered. |
| "Can you email the response?" | Not without a backend, so I didn't fake it. It's listed as a known limitation. |
| "Does the CV get uploaded?" | No — name, size and type are recorded; contents are never read. A real version needs multipart upload or a signed URL. |
| "It asks for preferred language, then ignores it." | Correct. `Intl.DisplayNames` and ISO codes are the groundwork for i18n, not the feature. Listed as a limitation. |
| "Did you use AI?" | Yes — the policy allows it. Then answer the actual question they're asking, which is whether you understand it. Pick a decision and explain the alternative you rejected. |

On that last one: the **worst** thing you can do is claim you wrote every line
unaided. The second worst is "the AI did it." The right answer is to talk about
the code like an engineer who owns it — which requires §8.

---

## 8. Homework

In priority order. Read the file, then re-answer the drills without the answers.

1. **`src/validation/schemas.js`** (285 lines) — the rules, the ordering fix, the
   date `transform`, the conditional `when()` branches. Most likely to be opened
   in front of you.
2. **`src/components/MultiStepForm.js`** (299) — step gating, `STEP_FIELDS`, focus
   management, the full-schema backstop.
3. **`src/utils/phonePrefill.js`** (47) — short, and the `isBareDialCode` reasoning
   is the kind of detail that impresses.
4. **`src/components/FormFields.js`** (281) — where all the accessibility lives.
5. **`supabase/schema.sql`** — the RLS policies and the generated columns. Short,
   and the highest ratio of interview value to reading time in the repo.
6. **`src/services/submissionStore.js`** — the two tiers, and `getStats` counting
   in Postgres with `head: true`.
7. **`src/utils/adminRows.js`** (88) — the CSV injection guard.
8. **`DESIGN.md`** — the long-form version of §4, with the rejected alternatives.

Then run this and watch it go green, so you know what 107 passing tests means:

```bash
npm test -- --watchAll=false
```

And make a change that *breaks* something on purpose — delete
`excludeEmptyString: true` from the phone rule and see which test fails. Knowing
what your tests actually protect is worth more than knowing the count.
