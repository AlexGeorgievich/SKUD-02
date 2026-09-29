import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const password=process.env.TIMETRACK_TEST_PASSWORD;
if(!password)throw new Error('Set TIMETRACK_TEST_PASSWORD for the local preview account');
const output='test-results/hr-reference';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:8001/',{waitUntil:'domcontentloaded',timeout:60000});
await page.getByLabel('Пароль').waitFor();
await page.getByLabel('Пароль').fill(password);
await page.getByRole('button',{name:'Войти в систему →'}).click();
await page.getByRole('button',{name:'Кадровый учёт'}).click();
await page.getByRole('heading',{name:'Персональный учёт сотрудников'}).waitFor();
await page.locator('.hr-person').first().waitFor();
const registryContract=await page.evaluate(()=>{
 const summary=document.querySelector('.hr-department-summary');
 const search=document.querySelector('[aria-label="Поиск сотрудников"]');
 const add=document.querySelector('[aria-label="Добавить сотрудника"]');
 const header=document.querySelector('.hr-system-actions');
 const metrics=document.querySelector('.hr-inline-metrics');
 if(!summary||!search||!add||!header||!metrics)return {ok:false,reason:'missing registry controls'};
 const summaryStyle=getComputedStyle(summary);
 const buttons=[...summary.querySelectorAll('button')];
 const buttonStyle=buttons[0]?getComputedStyle(buttons[0]):null;
 const compact=buttonStyle?parseFloat(buttonStyle.paddingTop)<=4&&parseFloat(buttonStyle.paddingRight)<=6:false;
 const intact=buttons.every(button=>button.scrollWidth<=button.clientWidth+1);
 const oneLine=new Set(buttons.map(button=>Math.round(button.getBoundingClientRect().top))).size<=1;
 const fits=summary.scrollWidth<=summary.clientWidth+1;
 return {
  ok:metrics.textContent.includes('Офис')&&!metrics.textContent.includes('Группы')&&
   Boolean(search.compareDocumentPosition(add)&Node.DOCUMENT_POSITION_FOLLOWING)&&!header.contains(add)&&
   summaryStyle.flexWrap==='nowrap'&&summaryStyle.overflowX==='auto'&&buttonStyle?.whiteSpace==='nowrap'&&
   parseFloat(buttonStyle?.fontSize||'0')>=10&&compact&&intact&&oneLine&&fits,
  metrics:metrics.textContent,flexWrap:summaryStyle.flexWrap,overflowX:summaryStyle.overflowX,
  fontSize:buttonStyle?.fontSize,padding:buttonStyle?.padding,intact,oneLine,fits,
 };
});
if(!registryContract.ok)throw new Error(`HR registry contract failed: ${JSON.stringify(registryContract)}`);
await page.screenshot({path:`${output}/employees.png`,fullPage:true});
await page.getByRole('tab',{name:'Календарь и юбилеи'}).click();
await page.getByRole('heading',{name:'Дни рождения и годовщины работы'}).waitFor();
await page.locator('.hr-event-card,.hr-empty-state').first().waitFor();
await page.screenshot({path:`${output}/calendar.png`,fullPage:true});
await page.getByRole('tab',{name:'Отчёты и аналитика'}).click();
await page.getByRole('heading',{name:/Сводные отчёты по персоналу/}).waitFor();
await page.locator('.hr-report-grid').waitFor();
await page.screenshot({path:`${output}/analytics.png`,fullPage:true});
await page.getByRole('tab',{name:'Сотрудники'}).click();
await page.getByRole('button',{name:'Добавить сотрудника'}).click();
const card=page.getByRole('dialog',{name:'Новая карточка сотрудника'});
await card.waitFor();
await page.screenshot({path:`${output}/new-employee.png`,fullPage:true});
const cardBox=await card.boundingBox();
const photoBox=await card.getByLabel('Фото сотрудника').boundingBox();
await card.getByRole('button',{name:'Закрыть'}).click();
await page.getByRole('button',{name:'Администрирование'}).click();
await page.getByRole('tab',{name:'Справочники'}).click();
await page.getByRole('heading',{name:'Справочники кадрового учёта'}).waitFor();
const catalogTitles=['Юридические лица','Офисы','Отделы','Должности'];
for(const title of catalogTitles)await page.getByRole('heading',{name:title,exact:true}).waitFor();
await page.screenshot({path:`${output}/admin-catalogs.png`,fullPage:true});
console.log(JSON.stringify({registry:registryContract,card:cardBox,photo:photoBox,adminCatalogs:catalogTitles}));
await browser.close();
process.exit(0);
