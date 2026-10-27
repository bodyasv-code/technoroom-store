-- All attempted writes are rolled back. Never remove the final ROLLBACK.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
set local technoroom.import_write='true';
do $$
declare target bigint;message text;
begin
 foreach target in array array[247,576,4331] loop
  begin
   update public.products set specifications=specifications||'{"IMPORT-GUARD-TEST":"must-not-save"}'::jsonb where id=target;
   raise exception 'Guard failed for %',target;
  exception when serialization_failure then
   get stacked diagnostics message=message_text;
   if message not like 'Reviewed specifications protected%' then raise;end if;
  end;
 end loop;
 foreach target in array array[247,4331] loop
  begin
   update public.products set description='IMPORT-GUARD-TEST' where id=target;
   raise exception 'Description guard failed for %',target;
  exception when serialization_failure then
   get stacked diagnostics message=message_text;
   if message not like 'Reviewed description protected%' then raise;end if;
  end;
 end loop;
 -- Exercise a commercial update inside the same rollback-only transaction.
 update public.products set price=price+1 where id in (247,576,4331);
 if (select count(*) from technoroom_maintenance.product_repair_backup where operation='reviewed-content-pilot-20261027')<>3 then raise exception 'Three backups required';end if;
 if (select count(*) from technoroom_maintenance.reviewed_product_content where operation='reviewed-content-pilot-20261027')<>3 then raise exception 'Three review records required';end if;
end $$;
select 'Content guards and commercial updates passed; all test writes rolled back' as verification;
rollback;
