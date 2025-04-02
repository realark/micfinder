
-- cd backend && node -e "console.log(require('bcrypt').hashSync('testpassword', 10))"
insert into app_user (email, full_name, password_hash, password_reset_required)
values ('testy@gmail.com', 'Testy Testerson', '$2b$10$Gzq2NEkBkECNo43NscAh5ePN7nuDgP8pHLC.9ULjc/CytXzWv45yq', FALSE)
;

INSERT INTO mic (DATA, last_edited_by)
VALUES (
  '{"id": "43e2d825-f8d5-4f43-a9aa-5c73f1c9dbc3", "name": "test mic", "location": "123 Fake St", "showTime": "20:00", "startDate": "2025-04-01", "recurrence": "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", "edit_version": 1, "signupInstructions": "In person, 30 minutes before show"}'::jsonb,
  (SELECT id FROM app_user WHERE email = 'testy@gmail.com')
);
