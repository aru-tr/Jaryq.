-- Run in Supabase SQL Editor. No credentials belong in this file.
create table if not exists public.lab_teachers (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.lab_submissions (
 id uuid primary key,
 created_at timestamptz not null default now(),
 student_name text not null check (length(student_name) between 2 and 100),
 student_class text not null check (length(student_class) between 1 and 30),
 answers jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 40000),
 measurements jsonb not null check (jsonb_typeof(measurements) = 'array' and jsonb_array_length(measurements) <= 25)
);
alter table public.lab_teachers enable row level security;
alter table public.lab_submissions enable row level security;
revoke all on public.lab_teachers, public.lab_submissions from anon, authenticated;
grant select on public.lab_teachers, public.lab_submissions to authenticated;
drop policy if exists teacher_self on public.lab_teachers;
create policy teacher_self on public.lab_teachers for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists teacher_read on public.lab_submissions;
create policy teacher_read on public.lab_submissions for select to authenticated
 using (exists (select 1 from public.lab_teachers where user_id = (select auth.uid())));
create or replace function public.submit_lab(submission_id uuid, student_name text, student_class text, answers jsonb, measurements jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if student_name is null or length(trim(student_name)) not between 2 and 100
 or student_class is null or length(trim(student_class)) not between 1 and 30
 or answers is null or jsonb_typeof(answers) <> 'object' or octet_length(answers::text) > 40000
 or measurements is null or jsonb_typeof(measurements) <> 'array'
 then raise exception 'Invalid submission'; end if;
 if jsonb_array_length(measurements) > 25 or octet_length(measurements::text) > 15000 then raise exception 'Invalid measurements'; end if;
 insert into public.lab_submissions(id,student_name,student_class,answers,measurements)
 values (submission_id,trim(student_name),trim(student_class),answers,measurements)
 on conflict (id) do nothing;
end;
$$;
revoke all on function public.submit_lab(uuid,text,text,jsonb,jsonb) from public;
grant execute on function public.submit_lab(uuid,text,text,jsonb,jsonb) to anon, authenticated;
