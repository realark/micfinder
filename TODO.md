MVP:
- [X] mic editor, UI for req fields, start time field
- [X] mic editor, allow empty non-required fields
- [X] mic editor, friendly recurrence picker
- [X] password reset page
- [X] guard against script injection
- [X] loading animation for serverless wakeup
- [X] implement optimistic concurrency
- [X] Make moble rendering non-fugly
- [X] switch to free postgres hosting
- [ ] Colab setup
  - [ ] Documentation
  - [ ] CI and branch protection
- [ ] Analytics
- [ ] Add remaining mics
- [ ] make project public

BACKLOG
- [ ] tech debt
  - [ ] db migrations
  - [ ] refactor existing code into sensible modules (config, persistence test doubles, unit test helpers, unit vs integration tests, etc)
- [ ] ops
  - [ ] views for human friendly audit logging
  - [ ] tools for db rollback/restore
- [ ] potential features
  - [ ] automated password reset via email
  - [ ] better editing of recurring events (edit "this event" vs "entire series")
  - [ ] automated signup list
