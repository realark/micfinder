
CREATE TABLE mics (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  venue TEXT,
  description TEXT
);
