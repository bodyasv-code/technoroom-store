-- Rollback-only probe. Keep the final ROLLBACK.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
set local technoroom.import_write='true';
do $$
declare target bigint;message text;
begin
 foreach target in array array[4907,4908,4909,4910] loop
  begin
   update public.products set specifications=specifications||'{"IMPORT-GUARD-TEST":"must-not-save"}'::jsonb where id=target;
   raise exception 'Guard failed for %',target;
  exception when serialization_failure then
   get stacked diagnostics message=message_text;
   if message not like 'Reviewed specifications protected%' then raise;end if;
  end;
 end loop;
 update public.products set price=price+1 where id in (4907,4908,4909,4910);
 if (select count(*) from technoroom_maintenance.product_repair_backup where operation='canon-075-magenta-yellow-20261028')<>4 then raise exception 'Four backups required';end if;
 if (select count(*) from technoroom_maintenance.reviewed_product_content where operation='canon-075-magenta-yellow-20261028')<>4 then raise exception 'Four review records required';end if;
end $$;
select 'Remaining-color guards, commercial updates and backups passed; test writes rolled back' as verification;
rollback;
