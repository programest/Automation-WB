const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const waitTillHTMLRendered = async (page, timeout = 20000) => {
  const checkDurationMsecs = 500;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 2;

  while (checkCounts++ <= maxChecks) {
    let html = await page.content();
    let currentHTMLSize = html.length;
    let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

    console.log('last:', lastHTMLSize, '<> curr:', currentHTMLSize, 'body html size:', bodyHTMLSize);

    if (lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize)
      countStableSizeIterations++;
    else
      countStableSizeIterations = 0;

    if (countStableSizeIterations >= minStableSizeIterations) {
      console.log('Page rendered fully.');
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await new Promise(resolve => setTimeout(resolve, checkDurationMsecs));
  }
};

async function runScraper(searchQuery = 'default query', startPage = 1, endPage = 5, question = 'Can I use 128GB cards?') {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium',
  });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.wildberries.ru/security/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await waitTillHTMLRendered(page);
    console.log('Waiting for login...');

    await page.waitForSelector('a.navbar-pc__link.j-wba-header-item[data-wba-header-name="DLV"]', { timeout: 0 });
    await waitTillHTMLRendered(page);

    await page.goto('https://www.wildberries.ru/', { waitUntil: 'networkidle2', timeout: 30000 });
    await waitTillHTMLRendered(page);
    await page.waitForSelector('input[id="searchInput"]', { timeout: 5000 });
    await page.click('input[id="searchInput"]', { delay: 50 });
    await page.type('input[id="searchInput"]', `${searchQuery} `, { delay: 30 });

    await page.keyboard.press('Enter');
    await waitTillHTMLRendered(page);
    await page.waitForSelector('.product-card-list', { timeout: 5000 });

    let allCards = [];
    let productTitles = [];
    let pageNum = startPage;

    while (pageNum <= endPage) {
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, window.innerHeight);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      });
      await waitTillHTMLRendered(page);

      const cards = await page.$$eval('.product-card.j-card-item', elements =>
        elements.map(el => ({
          id: el.getAttribute('data-nm-id'),
          link: el.querySelector('.product-card__link')?.getAttribute('href')
        })).filter(card => card.link)
      );
      allCards = allCards.concat(cards);

      const nextPage = await page.$('.pagination__wrapper .pagination-item.j-page');
      if (!nextPage || pageNum >= endPage) break;

      const totalPages = await page.$$eval('.pagination-item.j-page', els => els.length);
      if (pageNum >= totalPages) break;

      const nextPageLink = await page.$eval(`.pagination-item.j-page[href*="page=${pageNum + 1}"]`, el => el.getAttribute('href'));
      await page.goto(nextPageLink, { waitUntil: 'networkidle2', timeout: 30000 });
      await waitTillHTMLRendered(page);
      pageNum++;
    }

    for (const card of allCards) {
      await page.goto(card.link, { waitUntil: 'networkidle2', timeout: 30000 });
      await waitTillHTMLRendered(page);

      const title = await page.$eval('.product-page__title', el => el.textContent.trim());
      if (title) productTitles.push(title);

      await page.waitForSelector('li[data-content="Questions"]', { timeout: 5000 });
      await page.evaluate(() => document.querySelector('li[data-content="Questions"]').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await new Promise(resolve => setTimeout(resolve, 300));
      await page.evaluate(() => document.querySelector('li[data-content="Questions"] .user-activity__link').click());
      await waitTillHTMLRendered(page);

      await page.waitForSelector('textarea[id="new-question"]', { timeout: 10000 });
      await page.evaluate(() => document.querySelector('textarea[id="new-question"]').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await page.evaluate(() => {
        const textareaBlock = document.querySelector('.textarea-block');
        if (textareaBlock) textareaBlock.classList.add('textarea-block--active');
      });
      await page.focus('textarea[id="new-question"]');
      await page.type('textarea[id="new-question"]', question, { delay: 30 });

      await page.waitForSelector('.textarea-block__submit.btn-main', { timeout: 5000 });
      await page.evaluate(() => document.querySelector('.textarea-block__submit.btn-main').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await page.evaluate(() => document.querySelector('.textarea-block__submit.btn-main').click());
      await waitTillHTMLRendered(page);

      await page.waitForSelector('.btn-main.j-close', { timeout: 5000 });
      await page.evaluate(() => document.querySelector('.btn-main.j-close').click());
      await waitTillHTMLRendered(page);
    }

    const results = {
      processedCards: allCards.length,
      productTitles,
      timestamp: new Date().toISOString()
    };
    await fs.writeFile('results.json', JSON.stringify(results, null, 2));
    console.log('Collected product titles:', productTitles);
    return results;
  } finally {
    await browser.close();
  }
}

module.exports = { runScraper };