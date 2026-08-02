begin;

alter table public.appointments
	alter column care_recipient_id drop not null;

alter table public.medication_reminders
	alter column care_recipient_id drop not null;

alter table public.eating_reminders
	alter column care_recipient_id drop not null;

commit;