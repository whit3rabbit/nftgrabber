const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const url = process.argv[2];

if (!url) {
  console.log(`Please enter a URL (e.g. "npm start https://rarible.com/boredapeyachtclub").`);
  return;
}

(async () => {
  console.log("Loading...");
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on("request", (request) => {
      const resourceType = request.resourceType();
      if (
        resourceType === "document" ||
        resourceType === "xhr" ||
        resourceType === "fetch" ||
        resourceType === "script" ||
        resourceType === "image"
      ) {
        request.continue();
      } else {
        request.abort();
      }
    });

    await page.goto(url);
    await page.setViewport({
      width: 1200,
      height: 800,
    });

    await page.waitForSelector(".ReactVirtualized__Grid");

    const pageTitle = await page.title();
    const collection = pageTitle
      .split("-")
      .shift()
      .trim()
      .split(" ")
      .slice(0, 3)
      .join("-")
      .replace(/[^a-zA-Z0-9-]/g, "");
    if (!fs.existsSync(collection)) {
      fs.mkdirSync(collection);
    }

    let currentImage = 1;

    const imageUrls = await page.evaluate(() => {
      const imageElements = [...document.querySelectorAll(".ImageCard--image img")];
      return imageElements.map((element) => element.src.replace(/\/thumb\//, "/"));
    });

    await Promise.all(
      imageUrls
        .filter((url) => url.includes("t_image_preview"))
        .map(async (url) => {
          const fileName = url.split("/").pop() + ".avif";
          const filePath = path.resolve(__dirname, collection, fileName);
          const response = await page.goto(url);
          response.body().pipe(fs.createWriteStream(filePath));
          console.log(`${collection} #${currentImage} saved to ${collection}/${fileName}`);
          currentImage++;
        })
    );

    await autoScroll(page);

    await page.evaluate(() => {
      const elements = [...document.querySelectorAll("button")];
      const targetElement = elements.find((e) => e.innerText.includes("Load more"));
      targetElement && targetElement.click();
    });

    await autoScroll(page);
    await browser.close();
  } catch (error) {
    console.error("Error:", error);
  }
})();

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      let distance = 500;
      let timer = setInterval(() => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 1000);
    });
  });
}
