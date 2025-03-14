# Mic Finder
Application for managing a shared calendar of open mics. Content is maintained by the shared community in the spirit of a wiki.

Currently, the scope of this project is limited to the Boise open mic comedy scene. All accounts are manually added by the administrator. Since all editors of the site are known on a personal level, no moderation exists. That being said, audit trails are in place and malicious actors will have their accounts removed.

Additionally, this project is architected with growth scenarios in mind. Should the project wish to expand to other groups/scenes, traditional moderation features can be added in the future.

## Setup
- Install NPM

```sh
npm run dev
npm run dev -- --host # if you want to expose to external hosts (good for mobile phone testing)
```

## Deployments

Deployments occur when a change is pushed to master.

# TODO
- Vanilla Node backend with basic routing
- Real persistence layer
- Database snapshot create and restore
- Branch Protection
- Basic CI
