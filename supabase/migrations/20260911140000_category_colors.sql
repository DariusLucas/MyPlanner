alter table public.categories add column color text not null default 'orange';
alter table public.categories add constraint categories_color_check check (color in ('orange','blue','green','purple','rose','gold','teal','slate'));
update public.categories set color = case lower(name)
  when 'career' then 'orange' when 'content' then 'purple' when 'personal' then 'teal' else 'orange' end
where color = 'orange';
