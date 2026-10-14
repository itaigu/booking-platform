-- Cabo Sailing booking platform: a calendar color for each boat.
-- Paste this whole file into the Supabase SQL Editor and press "Run".

alter table boats add column color text not null default 'sky'
  check (color in ('sky', 'emerald', 'amber', 'rose', 'violet', 'orange', 'teal', 'slate'));

-- Give existing boats different colors to start with.
with numbered as (
  select id, row_number() over (order by id) - 1 as n from boats
)
update boats b
   set color = (array['sky', 'emerald', 'amber', 'rose', 'violet', 'orange', 'teal', 'slate'])[(numbered.n % 8) + 1]
  from numbered
 where numbered.id = b.id;
