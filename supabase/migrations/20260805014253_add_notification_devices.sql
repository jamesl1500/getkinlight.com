create table public.notification_devices (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
	device_id text not null,
	expo_push_token text not null unique,
	platform text not null check (platform in ('android', 'ios')),
	care_updates_enabled boolean not null default true,
	schedule_reminders_enabled boolean not null default true,
	invitations_enabled boolean not null default true,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	last_seen_at timestamptz not null default timezone('utc', now()),
	unique (user_id, device_id),
	constraint notification_devices_device_id_not_blank check (length(btrim(device_id)) > 0),
	constraint notification_devices_token_format check (expo_push_token ~ '^Expo(nent)?PushToken\\[[^]]+\\]$')
);

create index notification_devices_user_id_idx
on public.notification_devices(user_id);

alter table public.notification_devices enable row level security;

revoke all on table public.notification_devices from public, anon;
grant select, insert, update, delete on table public.notification_devices to authenticated;
grant select, insert, update, delete on table public.notification_devices to service_role;

create policy "notification_devices_select_own"
on public.notification_devices for select to authenticated
using (user_id = (select auth.uid()));

create policy "notification_devices_insert_own"
on public.notification_devices for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "notification_devices_update_own"
on public.notification_devices for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "notification_devices_delete_own"
on public.notification_devices for delete to authenticated
using (user_id = (select auth.uid()));

create trigger notification_devices_set_updated_at
before update on public.notification_devices
for each row execute function public.set_current_timestamp_updated_at();
