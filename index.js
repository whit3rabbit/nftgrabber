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
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url);
    await page.setViewport({
      width: 1200,
      height: 800,
    });

    await page.waitForSelector(".ReactVirtualized__Grid");

    const pageTitle = await page.title();
    const collection = pageTitle.split("-").shift().trim().split(" ").slice(0, 3).join("-")
      .replace(/[^a-zA-Z0-9-]/g, "");
    if (!fs.existsSync(collection)) {
      fs.mkdirSync(collection);
    }

    let currentImage = 1;

    page.on("response", async (response) => {
      const imageUrl = response.url();
      if (response.request().resourceType() === "image") {
        if (imageUrl.includes("t_image_preview")) {
          try {
            const fileName = imageUrl.split("/").pop() + ".avif";
            const filePath = path.resolve(__dirname, collection, fileName);
            const file = await response.buffer();
            fs.writeFileSync(filePath, file);
            console.log(`${collection} #${currentImage} saved to ${collection}/${fileName}`);
            currentImage++;
          } catch (error) {
            console.error(`Error saving ${imageUrl}`, error);
          }
        }
      }
    });

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
