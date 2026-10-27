begin;
set local lock_timeout='5s';set local statement_timeout='30s';set local standard_conforming_strings=on;
create temporary table restore_ups_plan(payload jsonb) on commit drop;
insert into restore_ups_plan values('{"specifications":{"Тип ДБЖ":"Онлайн із подвійним перетворенням","Повна потужність":"1000 ВА","Активна потужність":"900 Вт","Діапазон вхідної напруги":"176–280 В без зниження потужності; 110–176 В зі зниженням залежно від навантаження; 280–300 В зі зниженням потужності на 50%","Частота вхідної напруги":"40–70 Гц","Вихідна напруга":"208 / 220 / 230 / 240 В","Час перемикання на батарею":"0 мс","Вихідні розетки":"2 × Schuko","Вбудовані акумулятори":"2 × 12 В, 9 А·год","Тип акумулятора":"Герметичний свинцево-кислотний","Час заряджання до 90%":"3 год","Інтерфейси":"USB, RS-232; SNMP-адаптер — опція","Дисплей":"LCD","Ступінь захисту":"IP20","Робоча температура":"0–40 °C","Рівень шуму":"До 50 дБ (на відстані 1 м)"},"description":"Потужність 1000VA(900W), Тип: Он-лайн з подвійним перетворенням, Вхідна напруга: 110 ~ 176 VAC (лінійне зниження характеристик між 50% та 100% навантаження); 176 ~ 280 VAC (без погіршення характеристик); 280 ~ 300 VAC (зниження номінальних характеристик 50 %) Діапазон частоти: 40 ~ 70 Гц (автоматичне визначення) Вихідна напруга: Можливість задати напругу 208/220/230/240 В, Частота: 45 ~ 55 Hz або 55 ~ 65 Hz (synchronized range); 50 / 60 Hz ± 0,1 Hz (battery mode) ECO режим, мікропроцесорне керування, КНИ: ≤ 2% (linear load), ≤ 5% (non-linear load), Перевантаження: 105% ~ 125% for 1 min, 125% ~ 150% for 30 s, > 150% for 300 ms. Ефективність: ≥ 90% (Mains mode), ≥ 85% (Battery mode), ≥ 95% (ECO mode) Розетки: 2 х Schuko, Інтерфейс: RS-232, USB port , опціональний SNMP-адаптер, Багатофункціональний LCD-дисплей,, Тип встановлення - TOWER, Зарядний струм (макс,): 1А, Тип та кількість вбудованих батарей: 2 шт x 12B 9Aгод, Можливість підключення додаткових АКБ: опціонально 2 шт x 12B 9Aгод, Типовий час перезаряджання 3 години до ємності 90%, Габарити(ШхГхВ): 144х336х214 мм, Вага 9,5 кг, Робоча Температура: 0 - 40 С, Відносна вологість: 0 ~ 95% (без конденсації), IP-захист: IP 20, Рівень шуму: ≤ 50 dB (1 m). Захист від короткого замкнення, перевантаження, перегріву, розрядки акумулятора, перевірка вентилятора Гарантія: 2 роки на електроніку, 1 рік на батареї.","manual_overrides":{"verified_specifications":true}}'::jsonb);
do $restore$
declare current_row jsonb;saved jsonb;expected jsonb;after_row jsonb;
begin
 select payload into expected from restore_ups_plan;
 perform id from public.products where id=576 for update;
 select to_jsonb(p) into current_row from public.products p where id=576;
 if current_row is null or current_row->>'sku'<>'2E-OD1000' or current_row->>'brand'<>'2E' then raise exception 'Identity changed';end if;
 if current_row->'specifications' is distinct from expected->'specifications' or current_row->'description' is distinct from expected->'description' or current_row->'manual_overrides' is distinct from expected->'manual_overrides' then raise exception 'UPS changed since enrichment';end if;
 select before_row into saved from technoroom_maintenance.product_repair_backup where operation='reviewed-content-pilot-20261027' and product_id=576;
 if saved is null then raise exception 'Backup missing';end if;
 perform set_config('technoroom.import_write','false',true);
 update public.products set specifications=saved->'specifications' where id=576;
 select to_jsonb(p) into after_row from public.products p where id=576;
 if after_row->'specifications' is distinct from saved->'specifications' or (after_row-array['specifications','updated_at']) is distinct from (current_row-array['specifications','updated_at']) then raise exception 'Unexpected restore side effect';end if;
end $restore$;
commit;
