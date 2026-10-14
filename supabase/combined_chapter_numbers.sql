-- Allow chapter identifiers such as "9/10" for combined tests.
-- Safe for existing numeric chapter numbers: converts them to text without changing their displayed values.
alter table public.chapters
  alter column chapter_number type text
  using chapter_number::text;
