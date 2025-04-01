# Mic Finder
Application for managing a shared calendar of open mics. Content is maintained by the shared community in the spirit of a wiki.

Currently, the scope of this project is limited to the Boise open mic comedy scene. All accounts are manually added by the administrator. Since all editors of the site are known on a personal level, no moderation exists. That being said, audit trails are in place and malicious actors will have their accounts removed.

Additionally, this project is architected with growth scenarios in mind. Should the project wish to expand to other groups/scenes, traditional moderation features can be added in the future.

Source code is licensed under The MIT License (see LICENSE.md).

# Public API

A public swagger API is available to backup (almost) all data on micfinder. For security reasons, user info is not accessible.

https://micfinder-backend.onrender.com/api-docs/

# Development
## Setup
- Install NPM
- Install docker and docker-compose
- Set up local config
```sh
cd backend
cp .env.sample .env # then make desired changes to your .env file
```

## Running tests
```sh
cd backend/
npm run test
```

## Running a local dev environment
Database:
```sh
docker-compose up
```

Frontend:
```sh
cd frontend/
npm run dev
# or, if you want to expose to external hosts (good for mobile phone testing)
npm run dev -- --host
```
Backend:
```sh
cd backend/
# or, if you want to expose to external hosts (good for mobile phone testing)
npm run dev -- --host
```

## Deployments
App deployments occur when a change is pushed to master.

Database migrations are not set up. Should changes to the database be required, this must be done by hand.
