# HPAIR Delegate Application

A multi-step delegate application form built for the HPAIR deliverable.

## Live links

| | |
| --- | --- |
| **Registration form portal** | https://hpair-deliverable2026-alpha.vercel.app |
| **Admin portal** | https://hpair-deliverable2026-alpha.vercel.app/#admin |

### Admin portal credentials

```
Username:  kelvincheung@college.harvard.edu
Password:  123456
```

> These are demonstration credentials for a throwaway account, published so
> reviewers can open the admin portal. Anything submitted through the live form
> is therefore readable by anyone with this link — please don't enter real
> personal details.

## What to look at

- **The form** — four steps plus a review. Real-time validation, a CV upload,
  conditional questions (LinkedIn, visa invitation letter, financial aid),
  auto-saved progress, and a confirmation you can save as a PDF.
- **The admin portal** — submissions as rows with counts, an expandable detail
  view, a signed link to each stored CV, and a CSV export.
- **[`DESIGN.md`](DESIGN.md)** — every significant decision, the alternative
  rejected, and the cost paid. Including the access-control bug found in the
  starter repo and how it was fixed.
- **[`supabase/schema.sql`](supabase/schema.sql)** — the Row Level Security
  policies. Reads are refused by Postgres, not by the front-end.

## Running it locally

```bash
npm install
npm start                          # http://localhost:3000
npm test -- --watchAll=false       # 123 tests
CI=true npm run build              # what Vercel runs
```

It runs without any configuration — submissions fall back to browser-local
storage and the admin view says so. To connect a database, see
[`DESIGN.md` §9](DESIGN.md).

---

<details>
<summary><strong>Original deliverable brief</strong></summary>

Build a **personal information form application** with the following features:

---

## Recommended Features

1. **Form Validation**
   - Real-time validation  
   - Clear error messages for invalid fields  
   - Prevent submission until all data is valid  

2. **Form Fields**  
   Include (at minimum):  
   - Address  
   - CV (file upload)  
   - Phone number  
   - Nationality  
   - LinkedIn URL  
   - Preferred language  
   - *(Feel free to propose and add more fields that improve usefulness or user experience.)*  


3. **Form Submission**
   - Handle form data submission  
   - Display success and error states  
   - Show a clear confirmation message after submission  

4. **Responsive Design**
   - Mobile-friendly layout  
   - Clean, accessible, and user-friendly styling  

---

## Bonus / Creative Features

1. **User Experience Enhancements**
   - Loading states  
   - Inline success/error notifications  
   - Auto-save of progress  
   - Smooth keyboard navigation  

2. **Extended Functionality**
   - Email the response to a provided email  
   - Provide a downloadable summary of the submission  
   - Implement **conditional questions** (e.g., only ask for a LinkedIn URL if the user indicates they have one)  
   - Any additional feature you believe would improve usability or make the form stand out  

 *We would love to see something beyond just the basics—demonstrate creativity by proposing and implementing at least one additional feature or unique UI/UX improvement.*  

---

## Getting Started
0. Fork this repository to your personal github account

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm start
   ```

---

## Submission

Please create an account at [Vercel](https://vercel.com/) and then link your repo. It should automatically pull and build your main branch. Be sure to check that you are not getting any errors before submitting. You will need to submit both the vercel link to your deployment and the link to your GitHub repository.

## Issues or Assistance

If you run into any issues cloning the repo or breaking bugs that seem outside of your ability to fix, please reach out to Christopher Qiu and Ashley Zheng at cqiu@college.harvard.edu and ashleyzheng@college.harvard.edu. Good luck, we look forward to your submissions!

## AI Policy

You're allowed to use AI to complete this deliverable. In the same time, all code you submit is a fair game for the interview - including design decisions, features implementation and trade-offs

</details>
