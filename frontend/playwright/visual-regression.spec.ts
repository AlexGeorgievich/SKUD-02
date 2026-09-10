import {test,expect} from '@playwright/test';

test('проверяет визуальную структуру План-факт и компактность BI KPI',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Логин').fill('admin');
 await page.getByLabel('Пароль').fill('123');
 await page.getByRole('button',{name:'Войти в систему'}).click();
 await expect(page.locator('#workspace')).toBeVisible();
 expect(await page.locator('#workspace header').evaluate(element=>getComputedStyle(element).position)).toBe('sticky');

 await page.getByRole('button',{name:'План-факт'}).click();
 const row=page.locator('tr.planfact-row').first();
 await expect(row).toBeVisible();
 await expect(row.locator('.planfact-source')).toContainText('план');
 await expect(row.locator('.planfact-source')).toContainText('факт');
 await expect(row.locator('[aria-label="План на 1"]')).toHaveText(/\S+/);
 await expect(row.locator('[aria-label="Факт СКУД за 1"]')).toHaveText(/\S+/);
 await expect(page.getByRole('columnheader',{name:'1 сб'})).toBeVisible();
 const frozen=page.locator('.calendar-table th.calendar-frozen');expect(await frozen.count()).toBe(3);expect(await frozen.first().evaluate(element=>getComputedStyle(element).position)).toBe('sticky');
 const planTopOffsets=await row.locator('.planfact-plan').evaluateAll(elements=>elements.map(element=>Math.round(element.getBoundingClientRect().top)));
 expect(Math.max(...planTopOffsets)-Math.min(...planTopOffsets)).toBeLessThanOrEqual(1);
 await row.click();
 const calendar=page.locator('.calendar-table');await page.keyboard.press('ArrowRight');await expect.poll(()=>calendar.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);await page.keyboard.press('ArrowLeft');
 await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toBeHidden();
 await row.screenshot({path:'test-results/planfact-row.png'});
 await page.screenshot({path:'test-results/planfact-page.png',fullPage:true});

 await page.getByRole('button',{name:'Дашборд'}).click();
 const kpis=page.locator('.bi-kpis');
 await expect(kpis).toBeVisible();
 const box=await kpis.boundingBox();
 expect(box?.height??999).toBeLessThan(140);
 await page.screenshot({path:'test-results/bi-dashboard-page.png',fullPage:true});

 await page.getByLabel('Отдел',{exact:true}).selectOption('HR');
 await expect(page.getByRole('img',{name:'Treemap структуры плана: HR'})).toBeVisible();
 await expect(page.locator('.plan-treemap-legend')).toBeVisible();
 await page.getByLabel('Отдел',{exact:true}).selectOption('');

 await page.getByRole('button',{name:'Аналитика и KPI'}).click();
 await expect(page.getByLabel('Дата аналитики')).toBeVisible();
 await expect(page.getByLabel('Статус плана')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Итого по офису'})).toBeVisible();
 const analyticKpis=page.locator('.kpis:not(.bi-kpis)');
 const analyticKpiBox=await analyticKpis.boundingBox();
 expect(analyticKpiBox?.height??999).toBeLessThan(120);
 const daily=page.getByTestId('daily-analytics');
 await daily.getByRole('button',{name:'Все отделы'}).click();
 await daily.locator('button.department-link').first().click();
 await expect(daily.getByRole('heading',{name:/Отдел:/})).toBeVisible();
 await daily.locator('tbody button.department-link').first().click();
 await expect(daily.getByRole('heading',{name:/Сотрудник:/})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(daily.getByRole('heading',{name:/Отдел:/})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(daily.getByRole('heading',{name:'Все отделы'})).toBeVisible();
 await page.screenshot({path:'test-results/analytics-kpi-date-filter.png',fullPage:true});
});
