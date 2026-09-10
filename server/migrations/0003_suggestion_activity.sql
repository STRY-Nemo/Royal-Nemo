-- Who did what on each idea (created, status changes, replies), newest last.
ALTER TABLE suggestions ADD COLUMN activity TEXT NOT NULL DEFAULT '[]';
