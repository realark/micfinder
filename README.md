# Mic Finder
Application for managing a shared calendar of open mics. Content is maintained by the shared community in the spirit of a wiki.

Currently, the scope of this project is limited to the Boise open mic comedy scene. All accounts are manually added by the administrator. Since all editors of the site are known on a personal level, no moderation exists. That being said, audit trails are in place and malicious actors will have their accounts removed.

Additionally, this project is architected with growth scenarios in mind. Should the project wish to expand to other groups/scenes, traditional moderation features can be added in the future.

Source code is licensed under The MIT License (see LICENSE.md).

# Public API

A public swagger API is available to backup (almost) all data on micfinder. For security reasons, user info is not accessible.

https://micfinder-backend.onrender.com/api-docs/
## Recurring events

Editors can set weekly or monthly recurrence, an optional end date, and individual
dates to skip. Monthly schedules can repeat on the same day of the month as the
start date, or on the **first, second, third, fourth, or last** occurrence of a
weekday (for example, the first Tuesday or last Friday). The interval also supports
schedules such as every two months on the third Thursday.

The start date is the earliest allowed occurrence; a weekday schedule starts on
the first matching date on or after it. Date-based monthly schedules skip months
without that date (for example, the 31st does not occur in February).

Selecting an occurrence in the calendar also provides a `Skip this date` action;
skipped dates can be restored from that occurrence or from the recurrence editor.
Recurrence end and exception dates use local `YYYY-MM-DD` values to preserve
date-only calendar semantics. Saved schedules retain their weekday and position
when reopened for editing, and event descriptions display the full monthly pattern.

Monthly weekday rules use `BYDAY` with `BYSETPOS`, for example:
`RRULE:FREQ=MONTHLY;BYDAY=TU;BYSETPOS=1` for the first Tuesday and
`RRULE:FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1` for the last Friday.

## Browsing on desktop and mobile

Desktop opens the month calendar; screens narrower than 640px open the mic list
for easier reading. Calendar/List and Month/Week remain available, and resizing
does not override a view selected during the session. On phones, Week shows a
vertical agenda and Month scrolls horizontally without squeezing event names.

Mic cards show the next scheduled date, show time, location, contact information
when provided, and sign-up instructions. Select a mic name or **View mic details**
to open its detail page. Long text wraps, and sign-up instructions retain line
breaks. Calendar events and view controls support keyboard focus.

The retro theme uses a locally bundled Silkscreen font for display headings and
view controls, with system sans-serif text for mic names and details. Theme colors
live in `frontend/src/index.css`; responsive panel styles live in `frontend/src/App.css`.
No external font service is contacted at runtime. Silkscreen is distributed under
the SIL Open Font License in `frontend/public/silkscreen-OFL.txt`.


# Development
## Setup
- Install NPM
- Install docker and docker-compose
- Set up local config
```sh
# from the repo root
cp .env.local.sample .env # then make desired changes to your .env file
# alternatively, if you just want to use the standard local file without making any changes
ln -s .env.local.sample .env
```

## Running tests
```sh
npm --prefix backend test  # Requires Docker for PostgreSQL
npm --prefix frontend test # Cache-first read regressions
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Running a local dev environment

From the repository root:

```sh
./localldev.sh
```

The script starts PostgreSQL with Docker Compose, waits for it, then starts the
backend and Vite frontend. It uses `.env.local.sample` as defaults and applies
any values from `.env` or the current shell. If the complete local application
is already running, the command exits successfully without starting duplicates.
Press Ctrl-C to stop the services that the script started.

By default, a test user will be created in the local env:
- username: `testy@gmail.com`
- password: `testpassword`

## Deployments
App deployments occur when a change is pushed to master.

NOTE: Database migrations are not set up. Should changes to the database be required, this must be done by hand.
