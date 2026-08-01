# Sab Wells Personal Training — Setup Guide

This app is one HTML file, one JS file, and a database schema. No build step,
no server to run — it talks directly to a Supabase project (free tier is
plenty to start) and is hosted for free on GitHub Pages, the same pattern as
your other apps.

You need to do five things, once:

1. Create a Supabase project
2. Run the database schema
3. Turn off email confirmation (so client logins work immediately)
4. Drop your project's URL and key into `app.js`
5. Push the three files to GitHub Pages

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New project**. Pick any name (e.g. "sab-wells-pt"), set a database
   password (save it somewhere), and choose the region closest to you
   (Sydney, if available).
3. Wait a minute or two for it to finish provisioning.

## 2. Run the database schema

1. In your new project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `schema.sql` (included with this app), copy the whole thing, and
   paste it into the SQL editor. Click **Run**.
4. Once that succeeds, optionally do the same with `seed_data.sql` — a
   separate file that adds a sample exercise library, three sample clients,
   and a couple of sample "Speak to Sabs" enquiries, so the app isn't empty
   on first look. This step is entirely optional; skip it if you'd rather
   start with a completely blank slate and add your own clients and
   exercises from inside the app.

**Why two files:** `schema.sql` only creates tables, security rules and
storage — nothing in it can fail from bad sample data. `seed_data.sql`
pokes at Supabase's internal login system directly to create working
sample logins, which is inherently a bit more fragile — if anything in it
ever fails, it can't take your actual tables down with it, because it runs
as a separate step.

**What schema.sql does, in plain English:** it creates all the tables the
app needs (client profiles, body stats, one-rep maxes, the exercise
library, programmed sessions, chat messages, and the "Speak to Sabs"
inbox), locks each one down so clients can only ever see their own data
(and you, as admin, can see everyone's), and sets up file storage for chat
videos/photos and library videos.

**Is it destructive?** No — it only *creates* things. Safe to run on a
brand new project, and safe to re-run if you ever need to.

## 3. Turn off email confirmation (but keep recovery emails on)

This is a dashboard setting, not something SQL can do.

1. Go to **Authentication → Sign In / Providers** (or **Authentication → Settings**, depending on your Supabase version) in the sidebar.
2. Find **Email** provider settings and turn **off** "Confirm email".
3. Save.

This matters because you (the admin) create every client account yourself —
there's no public sign-up page — and clients need to be able to log in with
the password you give them straight away, with no email link to click first.

This is separate from **password reset** emails, which stay on and don't
need any extra setup — Supabase sends those automatically, and that's what
Sab uses from inside the app to reset a client's password without ever
touching Supabase (see "Handing this over to Sab" below).

## 4. Connect the app to your project

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / publishable key**.
3. Open `app.js` in GitHub's web editor and find these two lines near the top:

   ```js
   const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR-PUBLISHABLE-OR-ANON-KEY';
   ```

4. Replace the placeholder values with your real URL and key, and commit.

## 5. Create your own (admin) login

The seed data creates three sample **clients** — it deliberately does not
create your own trainer account, since that needs to be tied to whichever
email you'll actually log in with.

1. In Supabase, go to **Authentication → Users → Add user → Create new user**.
   Enter your email and a password. Tick **Auto Confirm User**.
2. Go to **Table Editor → profiles → Insert row**, and add a row with:
   - `id`: the UUID of the user you just created (copy it from the Users page)
   - `role`: `admin`
   - `full_name`: `Sab Wells`
   - `must_change_password`: `false` (untick it — it's your own account, no need to force a reset)
3. Log in to the app with that email and password — you'll land straight on
   the Clients screen.

From here on, adding real clients is done entirely inside the app: **Clients
→ Add client**. It creates their login for you and shows you a temporary
password to send them (text, email, however you'd normally reach them) —
they'll be made to choose their own password the moment they log in.

## 6. Host it on GitHub Pages

Same as your other apps:

1. Create a new GitHub repo (or reuse an existing Pages setup).
2. Upload `index.html`, `app.js`, and `logo.webp` to the root of the repo — all three are required, `logo.webp` is the brand image the app displays throughout.
3. In the repo's **Settings → Pages**, set the source to your main branch, root folder.
4. GitHub will give you a URL like `https://yourname.github.io/sab-wells-pt/` — that's the app, live.

---

## Sample logins (from the seed data)

These three are ready to test with immediately after step 2 — no extra setup:

| Client | Email | Temporary password |
|---|---|---|
| Emma Sullivan | emma@example.com | TempPass123! |
| Jordan Pryce | jordan@example.com | TempPass123! |
| Marco Ferraro | marco@example.com | TempPass123! |

All three will be prompted to set a new password on first login, same as any
real client you add later. Feel free to delete them once you're happy things
work (Table Editor → profiles, then Authentication → Users to remove the
matching login).

## Handing this over to Sab

Once the five setup steps above are done, Sab never needs to log into
Supabase or GitHub for day-to-day use — everything below happens inside the
app itself:

- **Adding a client** — Clients → Add client. Shows a temporary password to send them.
- **Resetting a client's password** — Clients → a client → Edit profile → Reset password. Emails them a reset link directly; they choose their own new password. (Needs their email saved correctly on their profile — Sab can check/fix this himself under Edit profile too.)
- **Pausing a client's access** — Edit profile → Disable access. Keeps all their data, just blocks login until re-enabled.
- **Deleting a client entirely** — Edit profile → Delete client, with a confirmation step.
- **Programming sessions, messaging, the exercise library, everything else** — all in-app.

The only things that ever require Supabase or GitHub access are the
one-time setup above, and any future code changes to the app itself.

## A few notes on how things work

- **Chat & videos**: clients can either upload a video file (camera roll) or
  record one live in the app using their phone's camera — both send straight
  to Sab and appear instantly on his end (and vice versa) using Supabase's
  realtime feature. Videos are stored privately per client; nobody but that
  client and you can ever see them.
- **Exercise library**: only you can add/edit/remove exercises; clients can
  browse, search and filter, and watch the demo video from any programmed
  session or from the library directly.
- **Programming sessions**: from a client's profile (Clients → click a
  client → Program tab), you build a session from the exercise library with
  sets/reps/weight, and it appears on their dashboard and Sessions screen
  immediately.
- **One security trade-off worth knowing about**: creating client accounts
  from the "Add client" button works by calling Supabase's sign-up function
  and immediately restoring your own session — a well-known technique for
  apps like this that don't run their own backend server. It works
  reliably, but because everything happens in the browser, a technically
  determined person could in theory call that same sign-up function
  themselves. This is a reasonable trade-off for a coaching business at this
  scale; if you ever want it fully locked down, that would mean adding a
  small Supabase Edge Function down the track — happy to help with that
  later if it becomes a priority.
