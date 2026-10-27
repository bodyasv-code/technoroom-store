export function icecatImageCredit(paths){
  if(!Array.isArray(paths)||!paths.some(path=>/^products\/icecat\/[1-9]\d*\/[a-f0-9]{64}\.(?:jpg|png|webp)$/u.test(String(path))))return '';
  return '<p class="product-photo-credit" style="font-size:11px;line-height:1.5;color:#586f88">Фото: Icecat та виробник. Database Right data-sheet 2026 Icecat. All rights reserved. Матеріали надаються «як є», без гарантій щодо контенту. <a href="https://iceclog.com/open-content-license/" target="_blank" rel="noopener noreferrer">Open Icecat — ліцензія та застереження</a>. Файли скопійовано без зміни вмісту.</p>';
}
